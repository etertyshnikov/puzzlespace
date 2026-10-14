import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { api, type Specification, type SpecificationItem, type Project, type HouseSpecificationTemplate, type NomenclatureItem, type RequiredItemMaterial, type Organization, type ProjectContractData, type ProjectContractDataUpdate, type Customer, type SpecificationPhoto } from '../api/client'
import { RuDateInput } from '../components/RuDateInput'
import { DeleteIconButton, DuplicateIconButton, EditIconButton } from '../components/SettingsActionIcons'
import { ChromeBurgerButton } from '../components/ChromeBurgerButton'
import { useAppChrome } from '../context/AppChromeContext'
import { useAuth } from '../auth/AuthContext'
import { isAgentUser } from '../utils/userRoles'
import { HtmlCodeEditor } from '../components/HtmlCodeEditor'
import { QTY_BASIS_WALL_HEIGHT_K_M } from '../data/qtyBasisRules'
import { isOptionalTotalTemplateLine } from '../data/specTemplateLines'

/** Шаблон спецификации дома (house_specification_templates.id), с которого создаётся спецификация по кнопке в списке слева. */
const DEFAULT_HOUSE_SPECIFICATION_TEMPLATE_ID = 1

/** Сборка домокомплекта: кол-во = 3-я позиция шаблона, без ручного ввода. */
function isLinkedAssemblyItem(item: SpecificationItem): boolean {
  return item.qty_basis === 'linked_wall_kit_qty'
}

/** Утепление стен: только при «Двойной брус» в спецификации. */
function isWallInsulationItem(item: SpecificationItem): boolean {
  return item.qty_basis === 'wall_insulation_sds'
}

/** Даёт браузеру отрисовать спиннер до тяжёлой работы / скачивания. */
function yieldToPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

type ContractDocumentId =
  | 'supply_contract'
  | 'supply_appendix'
  | 'supply_appendix_2'
  | 'supply_acceptance_act'
  | 'mount_contract'
  | 'mount_works_act'

const CONTRACT_DOCUMENTS: { id: ContractDocumentId; label: string }[] = [
  { id: 'supply_contract', label: 'Договор поставки домокомплекта из минибруса' },
  { id: 'supply_appendix', label: 'Приложение 1 к договору поставки' },
  { id: 'supply_appendix_2', label: 'Приложение 2 к договору поставки' },
  { id: 'supply_acceptance_act', label: 'Акт приема-передачи домокомплекта' },
  { id: 'mount_contract', label: 'Договор сборки домокомплекта' },
  { id: 'mount_works_act', label: 'Акт выполненных работ по сборке домокомплекта' },
]

function contractDocumentLabel(docId: ContractDocumentId): string {
  return CONTRACT_DOCUMENTS.find((d) => d.id === docId)?.label ?? docId
}

function appendixTemplateCode(docId: ContractDocumentId): string | null {
  const map: Partial<Record<ContractDocumentId, string>> = {
    supply_appendix: 'dogovor_postavki_appendix',
    supply_appendix_2: 'dogovor_postavki_appendix_2',
    supply_acceptance_act: 'supply_acceptance_act',
    mount_works_act: 'mount_works_act',
  }
  return map[docId] ?? null
}

/** Шаблоны договора поставки: физ. / юр. лицо (код в contract_templates). */
const SUPPLY_CONTRACT_TEMPLATES = {
  individual: { code: 'dogovor_postavki_fiz', label: 'Договор с физ лицом' },
  legal: { code: 'dogovor_postavki_ur', label: 'Договор с юр лицом' },
} as const

function PrinterIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  )
}

const CUSTOMER_CONTRACT_COMMON_KEYS = ['address'] as const

const CUSTOMER_CONTRACT_LEGAL_KEYS = [
  'legal_company_name',
  'legal_inn',
  'legal_kpp',
  'legal_ogrn',
  'legal_company_address',
  'legal_bank',
  'legal_bank_account',
  'legal_bik',
  'legal_signatory_name',
  'legal_signatory_basis',
] as const

const CUSTOMER_CONTRACT_INDIVIDUAL_KEYS = [
  'last_name',
  'name',
  'middle_name',
  'passport_series',
  'passport_number',
  'passport_issued_by',
  'passport_issue_date',
  'passport_department_code',
  'birth_date',
  'birth_place',
] as const

function commonPatchFromForm(form: Partial<Customer>): Partial<Customer> {
  const out: Partial<Customer> = {}
  for (const key of CUSTOMER_CONTRACT_COMMON_KEYS) {
    const v = form[key as keyof Customer]
    if (v != null && String(v).trim() !== '') {
      ;(out as Record<string, string>)[key] = String(v).trim()
    }
  }
  return out
}

function legalPatchFromForm(form: Partial<Customer>): Partial<Customer> {
  const out: Partial<Customer> = {}
  for (const key of CUSTOMER_CONTRACT_LEGAL_KEYS) {
    const v = form[key as keyof Customer]
    if (v != null && String(v).trim() !== '') {
      ;(out as Record<string, string>)[key] = String(v).trim()
    }
  }
  return out
}

function individualPatchFromForm(form: Partial<Customer>): Partial<Customer> {
  const out: Partial<Customer> = {}
  for (const key of CUSTOMER_CONTRACT_INDIVIDUAL_KEYS) {
    const v = form[key as keyof Customer]
    if (v != null && String(v).trim() !== '') {
      ;(out as Record<string, string>)[key] = String(v).trim()
    }
  }
  return out
}

/** После PATCH API может не вернуть legal_* — не затираем введённые в форме значения. */
function mergeContractFormAfterSave(prev: Partial<Customer>, saved: Customer): Partial<Customer> {
  const base = customerToContractForm(saved)
  const out: Partial<Customer> = { ...base }
  for (const key of [...CUSTOMER_CONTRACT_COMMON_KEYS, ...CUSTOMER_CONTRACT_LEGAL_KEYS, ...CUSTOMER_CONTRACT_INDIVIDUAL_KEYS]) {
    const apiVal = saved[key as keyof Customer]
    const prevVal = prev[key as keyof Customer]
    if (apiVal != null && String(apiVal).trim() !== '') {
      ;(out as Record<string, string>)[key] = String(apiVal).trim()
    } else if (prevVal != null && String(prevVal).trim() !== '') {
      ;(out as Record<string, string>)[key] = String(prevVal).trim()
    }
  }
  return out
}

type ContractPanelDraft = {
  contractDataForm: ProjectContractDataUpdate
  contractModalCustomerForm: Partial<Customer>
  contractCustomerPartyTab: 'individual' | 'legal'
}

function contractDraftStorageKey(projectId: number): string {
  return `smetadoma05:contract-draft:${projectId}`
}

function readContractDraft(projectId: number): ContractPanelDraft | null {
  try {
    const raw = sessionStorage.getItem(contractDraftStorageKey(projectId))
    if (!raw) return null
    return JSON.parse(raw) as ContractPanelDraft
  } catch {
    return null
  }
}

function writeContractDraft(projectId: number, draft: ContractPanelDraft): void {
  try {
    sessionStorage.setItem(contractDraftStorageKey(projectId), JSON.stringify(draft))
  } catch {
    /* quota / private mode */
  }
}

function customerToContractForm(c: Customer): Partial<Customer> {
  return {
    last_name: c.last_name ?? undefined,
    name: c.name,
    middle_name: c.middle_name ?? undefined,
    address: c.address ?? undefined,
    phone: c.phone ?? undefined,
    email: c.email ?? undefined,
    passport_series: c.passport_series ?? undefined,
    passport_number: c.passport_number ?? undefined,
    passport_issued_by: c.passport_issued_by ?? undefined,
    passport_issue_date: c.passport_issue_date ?? undefined,
    passport_department_code: c.passport_department_code ?? undefined,
    birth_date: c.birth_date ?? undefined,
    birth_place: c.birth_place ?? undefined,
    passport_scan: c.passport_scan ?? undefined,
    legal_company_name: c.legal_company_name ?? undefined,
    legal_inn: c.legal_inn ?? undefined,
    legal_kpp: c.legal_kpp ?? undefined,
    legal_ogrn: c.legal_ogrn ?? undefined,
    legal_company_address: c.legal_company_address ?? undefined,
    legal_bank: c.legal_bank ?? undefined,
    legal_bank_account: c.legal_bank_account ?? undefined,
    legal_bik: c.legal_bik ?? undefined,
    legal_signatory_name: c.legal_signatory_name ?? undefined,
    legal_signatory_basis: c.legal_signatory_basis ?? undefined,
  }
}

function formatNomenclatureLabel(n: NomenclatureItem): string {
  const name = (n.name || '').trim() || (n.item_number || '').trim() || `Позиция #${n.id}`
  const price = Number(n.total_cost ?? 0)
  const priceStr = price.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${name} - ${priceStr}`
}

function formatCalcDim(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return Number(n).toLocaleString('ru-RU', { maximumFractionDigits: 2 })
}

/** Сумма в поле ввода: 1 000 000 */
function formatAmountInput(v: number | string | null | undefined): string {
  if (v == null || v === '') return ''
  const n = typeof v === 'string' ? parseFloat(v.replace(/\s+/g, '').replace(',', '.')) : Number(v)
  if (!Number.isFinite(n)) return ''
  return n.toLocaleString('ru-RU', { maximumFractionDigits: 2 })
}

function parseAmountInput(raw: string): number | undefined {
  const t = raw.trim().replace(/\s+/g, '').replace(',', '.')
  if (t === '') return undefined
  const n = parseFloat(t)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

function calcRectPerimeter(length: number | null, width: number | null): number | null {
  if (length == null || width == null) return null
  return 2 * (length + width)
}

function calcRectArea(length: number | null, width: number | null): number | null {
  if (length == null || width == null) return null
  return length * width
}

/** Сторона домокомплекта = сторона дома − сторона террасы (пустая терраса = 0). */
function calcKitSide(houseSide: number | null, terraceSide: number | null): number | null {
  if (houseSide == null) return null
  const diff = houseSide - (terraceSide ?? 0)
  return diff >= 0 ? diff : null
}

/** Площадь террасы St = Lt×W; ×2 при «Терраса на втором этаже». */
function calcTerraceAreaM2(
  houseWidthM: number | null,
  terraceLengthM: number | null,
  terraceSecondFloor: boolean,
): number | null {
  if (houseWidthM == null || terraceLengthM == null || houseWidthM <= 0 || terraceLengthM <= 0) return null
  const factor = terraceSecondFloor ? 2 : 1
  return houseWidthM * terraceLengthM * factor
}

/** Коэф. надбавки к периметру по числу комнат (как в perimeter_rooms_kit). */
function roomCountPerimeterAddon(roomCount: number | null): number {
  const rc = roomCount != null && roomCount >= 1 ? roomCount : 1
  if (rc === 1) return 0
  if (rc === 2) return 0.16
  if (rc === 3) return 0.32
  if (rc === 4) return 0.48
  return 0.65
}

/** Длина стен комнат, м: 2×(L+W) × коэф. по комнатам × (2 при двойном брусе). */
function calcRoomWallsLengthM(
  lengthM: number | null,
  widthM: number | null,
  roomCount: number | null,
  doubleTimber: boolean,
): number | null {
  const perimeter = calcRectPerimeter(lengthM, widthM)
  if (perimeter == null) return null
  const addon = roomCountPerimeterAddon(roomCount)
  if (addon <= 0) return 0
  const timberFactor = doubleTimber ? 2 : 1
  return perimeter * addon * timberFactor
}

/** Sst = Lst × k × Cr × Tb; Lst = 2×(L+W). */
function calcRoomWallsAreaM2(
  lengthM: number | null,
  widthM: number | null,
  roomCount: number | null,
  doubleTimber: boolean,
  wallHeightM: number | null,
): number | null {
  const lst = calcRectPerimeter(lengthM, widthM)
  if (lst == null) return null
  const cr = roomCountPerimeterAddon(roomCount)
  if (cr <= 0) return 0
  const k = wallHeightM != null && wallHeightM > 0 ? wallHeightM : QTY_BASIS_WALL_HEIGHT_K_M
  const tb = doubleTimber ? 2 : 1
  return lst * k * cr * tb
}

/** Sds = Pd × k × Tb × lot; k из спецификации. */
function calcKitWallAreaM2(
  kitPerimeterM: number | null,
  wallHeightM: number | null,
  doubleTimber: boolean,
  floors: number | null,
): number | null {
  if (kitPerimeterM == null) return null
  const k = wallHeightM != null && wallHeightM > 0 ? wallHeightM : QTY_BASIS_WALL_HEIGHT_K_M
  const tb = doubleTimber ? 2 : 1
  const lot = floors != null && floors >= 1 ? floors : 1
  return kitPerimeterM * k * tb * lot
}

const ADD_ITEM_MODAL_WIDTH_PX = 520

/** Декодирует HTML-сущности (&lt; → < и т.д.), чтобы разметка отображалась в редакторе. */
function decodeHtmlEntities(html: string): string {
  if (!html || typeof html !== 'string') return html
  const div = document.createElement('div')
  div.innerHTML = html
  return div.innerHTML
}

/** Сумма в рублях для подписей в интерфейсе (целые/дробные без принудительных копеек). */
function formatMoneyRuNullable(v: number | null | undefined): string {
  if (v == null) return '—'
  return `${Number(v).toLocaleString('ru-RU')} ₽`
}

function contractPdfHtmlBody(
  storedHtml: string | undefined,
  templateContent: string
): string | null {
  const saved = (storedHtml ?? '').trim()
  if (saved) return saved
  return templateContent.trim() ? templateContent : null
}

export function ProjectSpecifications() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { chromeCollapsed, toggleChromeCollapsed, setChromeCollapsed } = useAppChrome()
  const { user } = useAuth()
  const isAgent = isAgentUser(user)
  const id = projectId ? parseInt(projectId, 10) : NaN
  const [project, setProject] = useState<Project | null>(null)
  const [projectCustomer, setProjectCustomer] = useState<Customer | null>(null)
  const [editingProjectName, setEditingProjectName] = useState(false)
  const [projectNameDraft, setProjectNameDraft] = useState('')
  const [savingProjectName, setSavingProjectName] = useState(false)
  const [specs, setSpecs] = useState<Specification[]>([])
  const [specsLoading, setSpecsLoading] = useState(true)
  const [selectedSpecId, setSelectedSpecId] = useState<number | null>(null)
  const [items, setItems] = useState<SpecificationItem[]>([])
  const [itemsLoading, setItemsLoading] = useState(false)
  const [parts, setParts] = useState<{ id: number; name: string }[]>([])
  const [requiredItemTemplates, setRequiredItemTemplates] = useState<{ id: number; name: string }[]>([])
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const [templates, setTemplates] = useState<HouseSpecificationTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [applyingTemplate, setApplyingTemplate] = useState(false)
  const [updatingItemId, setUpdatingItemId] = useState<number | null>(null)
  const [expandedMaterialItemIds, setExpandedMaterialItemIds] = useState<number[]>([])
  const [materialsByTemplateId, setMaterialsByTemplateId] = useState<Record<number, RequiredItemMaterial[]>>({})
  const [materialsFetchStatus, setMaterialsFetchStatus] = useState<Record<number, 'idle' | 'loading' | 'error'>>({})
  const [showAddItemModal, setShowAddItemModal] = useState(false)
  const [addingItem, setAddingItem] = useState(false)
  const [nomenclature, setNomenclature] = useState<NomenclatureItem[]>([])
  const [addItemNomenclatureId, setAddItemNomenclatureId] = useState<number | ''>('')
  const [addItemNomenclatureSearch, setAddItemNomenclatureSearch] = useState('')
  const [addItemNomenclatureDropdownOpen, setAddItemNomenclatureDropdownOpen] = useState(false)
  const addItemNomenclatureDropdownRef = useRef<HTMLDivElement>(null)
  const [addItemQuantity, setAddItemQuantity] = useState(1)
  const [addItemUnit, setAddItemUnit] = useState('шт')
  const [addItemPrice, setAddItemPrice] = useState(0)
  const [editingItemId, setEditingItemId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ nomenclature_item_id: null as number | null, item_name: '', quantity: 0, unit: 'шт', price: 0 })
  const [editNomenclature, setEditNomenclature] = useState<NomenclatureItem[]>([])
  const [savingItem, setSavingItem] = useState(false)
  const [updatingKp, setUpdatingKp] = useState(false)
  const [kpInternalComment, setKpInternalComment] = useState('')
  const [savingKpComment, setSavingKpComment] = useState(false)
  const [specComment, setSpecComment] = useState('')
  const [savingSpecComment, setSavingSpecComment] = useState(false)
  const [creatingSpec, setCreatingSpec] = useState(false)
  const [specDimsForm, setSpecDimsForm] = useState<{
    building_type: 'house' | 'banya'
    length_m: string
    width_m: string
    terrace_length_m: string
    balcony_length_m: string
    floors: string
    room_count: string
    wall_height_m: string
    double_timber: boolean
    terrace_second_floor: boolean
  }>({
    building_type: 'house',
    length_m: '',
    width_m: '',
    terrace_length_m: '',
    balcony_length_m: '',
    floors: '',
    room_count: '',
    wall_height_m: '',
    double_timber: false,
    terrace_second_floor: false,
  })
  const [specTab, setSpecTab] = useState<'positions' | 'photos'>('positions')
  const [docTypeMenuOpen, setDocTypeMenuOpen] = useState(false)
  const [fillTemplateMenuOpen, setFillTemplateMenuOpen] = useState(false)
  const [downloadingKpClient2, setDownloadingKpClient2] = useState(false)
  const [downloadingKpClientV2, setDownloadingKpClientV2] = useState(false)
  const [downloadingKpStandartClient, setDownloadingKpStandartClient] = useState(false)
  const [kpClientDownloadLabel, setKpClientDownloadLabel] = useState('Формирование КП для клиента…')
  const [duplicatingSpecId, setDuplicatingSpecId] = useState<number | null>(null)
  const [contractTab, setContractTab] = useState<'data' | null>(null)
  const [activeContractDocumentId, setActiveContractDocumentId] = useState<ContractDocumentId | null>(null)
  const [contractDocumentEditorTab, setContractDocumentEditorTab] = useState<'template' | 'result'>('result')
  const [templateContent, setTemplateContent] = useState('')
  const [contractDocumentsHtml, setContractDocumentsHtml] = useState<Partial<Record<ContractDocumentId, string>>>({})
  const [savingResult, setSavingResult] = useState(false)
  const [contractPdfBlobUrl, setContractPdfBlobUrl] = useState<string | null>(null)
  const [contractPdfLoading, setContractPdfLoading] = useState(false)
  const [contractPdfError, setContractPdfError] = useState<string | null>(null)
  const [downloadingContractPdf, setDownloadingContractPdf] = useState(false)
  const contractPdfBlobUrlRef = useRef<string | null>(null)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [defaultOrganization, setDefaultOrganization] = useState<Organization | null>(null)
  const [contractData, setContractData] = useState<ProjectContractData | null>(null)
  const [contractDataForm, setContractDataForm] = useState<ProjectContractDataUpdate>({})
  const contractDataFormRef = useRef<ProjectContractDataUpdate>({})
  const [contractDataLoading, setContractDataLoading] = useState(false)
  const [contractDataSaving, setContractDataSaving] = useState(false)
  const [contractModalCustomer, setContractModalCustomer] = useState<Customer | null>(null)
  const [contractModalCustomerForm, setContractModalCustomerForm] = useState<Partial<Customer>>({})
  const contractModalCustomerFormRef = useRef<Partial<Customer>>({})
  const [contractDataModalTab, setContractDataModalTab] = useState<'documents' | 'contract'>('documents')
  const [printingDocumentId, setPrintingDocumentId] = useState<ContractDocumentId | null>(null)
  const [contractCustomerPartyTab, setContractCustomerPartyTab] = useState<'individual' | 'legal'>('individual')
  const [contractModalPassportScanKey, setContractModalPassportScanKey] = useState(0)
  const [contractModalPassportScanUploading, setContractModalPassportScanUploading] = useState(false)
  const [specPhotos, setSpecPhotos] = useState<SpecificationPhoto[]>([])
  const [specPhotosLoading, setSpecPhotosLoading] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoDropActive, setPhotoDropActive] = useState(false)
  const docTypeMenuRef = useRef<HTMLDivElement>(null)
  const fillTemplateMenuRef = useRef<HTMLDivElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const materialsTemplatesLoadedRef = useRef<Set<number>>(new Set())

  const positionsDocTypeOptions = useMemo((): {
    value: 'kp-overlay-client-2' | 'kp-overlay-client-v2' | 'kp-standart-client' | 'contract-form'
    label: string
  }[] => {
    const all = [
      { value: 'kp-overlay-client-2' as const, label: 'КП для клиента' },
      { value: 'kp-overlay-client-v2' as const, label: 'КП для клиента 2' },
      { value: 'kp-standart-client' as const, label: 'КП Стандарт (таблица)' },
      { value: 'contract-form' as const, label: 'Сформировать договор' },
    ]
    if (isAgent) return all.filter((o) => o.value !== 'contract-form')
    return all
  }, [isAgent])

  useEffect(() => {
    if (isAgent && contractTab === 'data') {
      setContractTab(null)
      setActiveContractDocumentId(null)
    }
  }, [isAgent, contractTab])

  useEffect(() => {
    contractModalCustomerFormRef.current = contractModalCustomerForm
  }, [contractModalCustomerForm])

  useEffect(() => {
    contractDataFormRef.current = contractDataForm
  }, [contractDataForm])

  useEffect(() => {
    if (!Number.isFinite(id)) return
    writeContractDraft(id, {
      contractDataForm,
      contractModalCustomerForm,
      contractCustomerPartyTab,
    })
  }, [id, contractDataForm, contractModalCustomerForm, contractCustomerPartyTab])

  useEffect(() => {
    if (!Number.isFinite(id)) return
    setContractTab(null)
    setActiveContractDocumentId(null)
    setContractData(null)
    setContractDataForm({})
    setContractModalCustomer(null)
    setContractModalCustomerForm({})
    setContractCustomerPartyTab('individual')
  }, [id])

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (docTypeMenuRef.current && !docTypeMenuRef.current.contains(target)) setDocTypeMenuOpen(false)
      if (fillTemplateMenuRef.current && !fillTemplateMenuRef.current.contains(target)) setFillTemplateMenuOpen(false)
    }
    document.addEventListener('click', onOutside)
    return () => document.removeEventListener('click', onOutside)
  }, [])

  useEffect(() => () => setChromeCollapsed(false), [setChromeCollapsed])

  /** Скрыть верхнее горизонтальное меню при прокрутке (не при ручном сворачивании бургером). */
  useEffect(() => {
    if (chromeCollapsed) return
    const main = document.querySelector('main.gentelella-right-col')
    if (!main) return
    const nav = document.querySelector('.gentelella-top-nav')
    const onScroll = () => {
      if (!nav) return
      if (main.scrollTop > 48) {
        nav.classList.add('gentelella-top-nav--hidden')
      } else {
        nav.classList.remove('gentelella-top-nav--hidden')
      }
    }
    main.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      main.removeEventListener('scroll', onScroll)
      nav?.classList.remove('gentelella-top-nav--hidden')
    }
  }, [chromeCollapsed])

  useEffect(() => {
    if (!Number.isFinite(id)) return
    api.projects.get(id).then(setProject).catch(() => setProject(null))
  }, [id])

  useEffect(() => {
    const customerId = project?.customer_id
    if (customerId == null) {
      setProjectCustomer(null)
      return
    }
    api.customers
      .get(customerId)
      .then(setProjectCustomer)
      .catch(() => setProjectCustomer(null))
  }, [project?.customer_id])

  const customerBudget = projectCustomer?.budget ?? null

  useEffect(() => {
    if (!showTemplatePicker) return
    setTemplatesLoading(true)
    api.houseSpecificationTemplates
      .list()
      .then(setTemplates)
      .catch(() => setTemplates([]))
      .finally(() => setTemplatesLoading(false))
  }, [showTemplatePicker])

  useEffect(() => {
    if (!Number.isFinite(id)) return
    setSpecsLoading(true)
    api.specifications
      .list({ project_id: id })
      .then((data) => {
        setSpecs(data)
        if (data.length > 0) setSelectedSpecId(data[0].id)
        else setSelectedSpecId(null)
      })
      .catch(() => { setSpecs([]); setSelectedSpecId(null) })
      .finally(() => setSpecsLoading(false))
  }, [id])

  useEffect(() => {
    const s = specs.find((x) => x.id === selectedSpecId)
    if (!s) {
      setSpecDimsForm({
        building_type: 'house',
        length_m: '',
        width_m: '',
        terrace_length_m: '',
        balcony_length_m: '',
        floors: '',
        room_count: '',
        wall_height_m: '',
        double_timber: false,
        terrace_second_floor: false,
      })
      return
    }
    setSpecDimsForm({
      building_type: s.building_type === 'banya' ? 'banya' : 'house',
      length_m: s.length_m != null ? String(s.length_m) : '',
      width_m: s.width_m != null ? String(s.width_m) : '',
      terrace_length_m: s.terrace_length_m != null ? String(s.terrace_length_m) : '',
      balcony_length_m: s.balcony_length_m != null ? String(s.balcony_length_m) : '',
      floors: s.floors != null ? String(s.floors) : '',
      room_count: s.room_count != null ? String(s.room_count) : '',
      wall_height_m: s.wall_height_m != null ? String(s.wall_height_m) : String(QTY_BASIS_WALL_HEIGHT_K_M),
      double_timber: Boolean(s.double_timber),
      terrace_second_floor: Boolean(s.terrace_second_floor),
    })
    setKpInternalComment((s.kp_internal_comment ?? '').trim())
    setSpecComment((s.comment ?? '').trim())
  }, [selectedSpecId, specs])

  const [contractDataForPlaceholders, setContractDataForPlaceholders] = useState<ProjectContractData | null>(null)
  const [customerForPlaceholders, setCustomerForPlaceholders] = useState<Customer | null>(null)

  const resolveBuyerPartyType = useCallback(
    (contractDataSnapshot?: ProjectContractData | null): 'individual' | 'legal' => {
      const p =
        contractDataForm.buyer_party_type ??
        contractDataSnapshot?.buyer_party_type ??
        contractData?.buyer_party_type ??
        contractDataForPlaceholders?.buyer_party_type
      return p === 'legal' ? 'legal' : 'individual'
    },
    [contractDataForm.buyer_party_type, contractData?.buyer_party_type, contractDataForPlaceholders?.buyer_party_type]
  )

  useEffect(() => {
    if (contractTab === 'data' && project?.customer_id != null) {
      api.customers.get(project.customer_id).then(setCustomerForPlaceholders).catch(() => setCustomerForPlaceholders(null))
    } else if (contractTab !== 'data') {
      setCustomerForPlaceholders(null)
    }
  }, [contractTab, project?.customer_id])

  useEffect(() => {
    if (contractTab === 'data') {
      api.organizations.list().then(setOrganizations).catch(() => setOrganizations([]))
      api.organizations.getDefault().then(setDefaultOrganization).catch(() => setDefaultOrganization(null))
    }
  }, [contractTab])

  useEffect(() => {
    if (contractTab === 'data' && Number.isFinite(id)) {
      api.projects.getContractData(id).then(setContractDataForPlaceholders).catch(() => setContractDataForPlaceholders(null))
    } else if (contractTab !== 'data') {
      setContractDataForPlaceholders(null)
    }
  }, [contractTab, id])

  const reloadCurrentSpecItems = useCallback(() => {
    if (selectedSpecId == null) return Promise.resolve([] as SpecificationItem[])
    return api.specifications
      .listItems(selectedSpecId)
      .then((next) => {
        setItems(next)
        return next
      })
      .catch(() => {
        setItems([])
        return [] as SpecificationItem[]
      })
  }, [selectedSpecId])

  useEffect(() => {
    if (selectedSpecId == null) {
      setItems([])
      return
    }
    setItemsLoading(true)
    reloadCurrentSpecItems().finally(() => setItemsLoading(false))
  }, [selectedSpecId, reloadCurrentSpecItems])

  useEffect(() => {
    materialsTemplatesLoadedRef.current.clear()
    setMaterialsByTemplateId({})
    setMaterialsFetchStatus({})
    setExpandedMaterialItemIds([])
  }, [selectedSpecId])

  useEffect(() => {
    if (expandedMaterialItemIds.length === 0) return
    if (nomenclature.length === 0) {
      void api.nomenclatureItems.list({ limit: 2000 }).then(setNomenclature).catch(() => setNomenclature([]))
    }
  }, [expandedMaterialItemIds, nomenclature.length])

  useEffect(() => {
    if (expandedMaterialItemIds.length === 0 || items.length === 0) return
    for (const i of items) {
      if (!expandedMaterialItemIds.includes(i.id) || i.template_id == null) continue
      const tid = i.template_id
      if (materialsTemplatesLoadedRef.current.has(tid)) continue
      materialsTemplatesLoadedRef.current.add(tid)
      setMaterialsFetchStatus((s) => ({ ...s, [tid]: 'loading' }))
      void api.requiredItemMaterials
        .list({ template_id: tid })
        .then((list) => {
          setMaterialsByTemplateId((c) => ({ ...c, [tid]: list }))
          setMaterialsFetchStatus((s) => ({ ...s, [tid]: 'idle' }))
        })
        .catch(() => {
          materialsTemplatesLoadedRef.current.delete(tid)
          setMaterialsFetchStatus((s) => ({ ...s, [tid]: 'error' }))
        })
    }
  }, [expandedMaterialItemIds, items])

  useEffect(() => {
    if (selectedSpecId == null) {
      setSpecPhotos([])
      return
    }
    setSpecPhotosLoading(true)
    api.specificationPhotos
      .listBySpec(selectedSpecId)
      .then(setSpecPhotos)
      .catch(() => setSpecPhotos([]))
      .finally(() => setSpecPhotosLoading(false))
  }, [selectedSpecId])

  const handleUploadPhotos = async (files: FileList | File[]) => {
    if (selectedSpecId == null) return
    setUploadingPhoto(true)
    try {
      const newPhotos = await api.specificationPhotos.uploadMany(Array.from(files), {
        specification_id: selectedSpecId,
        sort_order: specPhotos.length,
      })
      setSpecPhotos((prev) => [...prev, ...newPhotos])
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    } finally {
      setUploadingPhoto(false)
    }
  }

  const handleDeletePhoto = async (photoId: number) => {
    if (!confirm('Удалить фото?')) return
    try {
      await api.specificationPhotos.delete(photoId)
      setSpecPhotos((prev) => prev.filter((p) => p.id !== photoId))
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    }
  }

  useEffect(() => {
    api.parts.list().then(setParts).catch(() => setParts([]))
    api.requiredItemTemplates.list().then(setRequiredItemTemplates).catch(() => setRequiredItemTemplates([]))
  }, [])

  useEffect(() => {
    if (showAddItemModal) {
      api.nomenclatureItems.list({ limit: 2000 }).then(setNomenclature).catch(() => setNomenclature([]))
      setAddItemNomenclatureId('')
      setAddItemNomenclatureSearch('')
      setAddItemNomenclatureDropdownOpen(false)
      setAddItemQuantity(1)
      setAddItemUnit('шт')
      setAddItemPrice(0)
    }
  }, [showAddItemModal])

  useEffect(() => {
    if (!addItemNomenclatureDropdownOpen) return
    const onOutside = (e: MouseEvent) => {
      const el = addItemNomenclatureDropdownRef.current
      if (el && !el.contains(e.target as Node)) setAddItemNomenclatureDropdownOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [addItemNomenclatureDropdownOpen])

  const filteredAddItemNomenclature = useMemo(() => {
    const q = addItemNomenclatureSearch.trim().toLowerCase()
    if (!q) return nomenclature
    return nomenclature.filter((n) => {
      const partName = n.part_id != null ? parts.find((p) => p.id === n.part_id)?.name : ''
      const hay = [n.item_number, n.name, n.description, partName, String(n.total_cost ?? '')]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [nomenclature, addItemNomenclatureSearch, parts])

  const selectedAddItemNomenclature = useMemo(() => {
    if (addItemNomenclatureId === '') return undefined
    return nomenclature.find((n) => n.id === addItemNomenclatureId)
  }, [addItemNomenclatureId, nomenclature])

  const pickAddItemNomenclature = (n: NomenclatureItem) => {
    setAddItemNomenclatureId(n.id)
    if (n.unit) setAddItemUnit(n.unit)
    setAddItemPrice(Number(n.total_cost) ?? 0)
    setAddItemNomenclatureDropdownOpen(false)
    setAddItemNomenclatureSearch('')
  }

  const loadSpecs = () => {
    if (!Number.isFinite(id)) return
    setSpecsLoading(true)
    api.specifications
      .list({ project_id: id })
      .then(setSpecs)
      .catch(() => setSpecs([]))
      .finally(() => setSpecsLoading(false))
  }

  const handleDuplicateSpec = (e: React.MouseEvent, specId: number) => {
    e.stopPropagation()
    setDuplicatingSpecId(specId)
    api.specifications
      .duplicate(specId)
      .then((created) => {
        loadSpecs()
        setSelectedSpecId(created.id)
      })
      .catch((err) => alert(err instanceof Error ? err.message : String(err)))
      .finally(() => setDuplicatingSpecId(null))
  }

  const handleDeleteSpec = (e: React.MouseEvent, specId: number, specLabel: string) => {
    e.stopPropagation()
    if (!confirm(`Удалить спецификацию «${specLabel}» и все её позиции?`)) return
    api.specifications
      .delete(specId)
      .then(() => {
        if (selectedSpecId === specId) setSelectedSpecId(null)
        loadSpecs()
      })
      .catch((err) => alert(err instanceof Error ? err.message : String(err)))
  }

  /** Новая спецификация проекта + позиции и фото из шаблона дома по умолчанию. */
  const handleCreateSpecificationFromDefaultTemplate = () => {
    if (!project?.customer_id) {
      alert('Нет данных клиента по проекту.')
      return
    }
    if (!Number.isFinite(id)) return
    setCreatingSpec(true)
    api.specifications
      .create({
        customer_id: project.customer_id,
        project_id: id,
        status_id: 1,
        length_m: 5,
        width_m: 6,
        floors: 1,
        room_count: 1,
        wall_height_m: QTY_BASIS_WALL_HEIGHT_K_M,
      })
      .then((created) =>
        api.specifications
          .applyHouseTemplate(created.id, DEFAULT_HOUSE_SPECIFICATION_TEMPLATE_ID)
          .then((newItems) => ({ created, newItems }))
      )
      .then(({ created, newItems }) => {
        setSelectedSpecId(created.id)
        setItems(newItems)
        setShowTemplatePicker(false)
        setSpecTab('positions')
        api.specificationPhotos.listBySpec(created.id).then(setSpecPhotos).catch(() => setSpecPhotos([]))
        loadSpecs()
      })
      .catch((e) => alert(e instanceof Error ? e.message : String(e)))
      .finally(() => setCreatingSpec(false))
  }

  const handleSelectTemplate = (templateId: number) => {
    if (selectedSpecId == null) return
    setApplyingTemplate(true)
    api.specifications
      .applyHouseTemplate(selectedSpecId, templateId)
      .then(() => {
        setShowTemplatePicker(false)
        api.specificationPhotos.listBySpec(selectedSpecId).then(setSpecPhotos).catch(() => {})
        return api.specifications.listItems(selectedSpecId)
      })
      .then(setItems)
      .catch((e) => alert(e instanceof Error ? e.message : String(e)))
      .finally(() => setApplyingTemplate(false))
  }

  const itemsByPart = useMemo(() => {
    const map = new Map<number | 'none', SpecificationItem[]>()
    for (const i of items) {
      const key = i.part_id ?? 'none'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(i)
    }
    return map
  }, [items])

  const partOrder = useMemo(() => {
    const keys = Array.from(itemsByPart.keys())
    const fromParts = parts.map((p) => p.id).filter((pid) => keys.includes(pid))
    const rest = keys.filter((k) => k === 'none' || !parts.some((p) => p.id === k))
    return [...fromParts, ...rest] as (number | 'none')[]
  }, [parts, itemsByPart])

  const getPartName = (partId: number | null | undefined) => {
    if (partId == null) return null
    return parts.find((p) => p.id === partId)?.name ?? null
  }

  const formatQtyAuto = (n: number | null | undefined) => {
    if (n == null || Number.isNaN(Number(n))) return '—'
    return Number(n).toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 3 })
  }

  const handleUpdateItemQtyPrice = (
    item: SpecificationItem,
    quantity: number | null,
    price: number | null,
    discountPercent: number | null,
  ) => {
    if (selectedSpecId == null) return
    if (isWallInsulationItem(item) && !specDimsForm.double_timber) return
    const payload: { quantity?: number; price?: number; discount_percent?: number } = {}
    if (quantity !== null && quantity !== undefined) payload.quantity = quantity
    if (price !== null && price !== undefined) payload.price = price
    if (discountPercent !== null && discountPercent !== undefined) payload.discount_percent = discountPercent
    if (Object.keys(payload).length === 0) return
    setUpdatingItemId(item.id)
    api.specifications
      .updateItem(selectedSpecId, item.id, payload)
      .then(async (updated) => {
        if (quantity !== null && quantity !== undefined) {
          await reloadCurrentSpecItems()
        } else {
          setItems((prev) => prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)))
        }
        loadSpecs()
      })
      .catch((e) => alert(e instanceof Error ? e.message : String(e)))
      .finally(() => setUpdatingItemId(null))
  }

  const handleUpdateItemIncludeInTotal = (item: SpecificationItem, includeInTotal: boolean) => {
    if (selectedSpecId == null || !isOptionalTotalTemplateLine(item.template_line_no)) return
    if (Boolean(item.include_in_total) === includeInTotal) return
    setUpdatingItemId(item.id)
    api.specifications
      .updateItem(selectedSpecId, item.id, { include_in_total: includeInTotal })
      .then(async () => {
        await reloadCurrentSpecItems()
        loadSpecs()
      })
      .catch((e) => alert(e instanceof Error ? e.message : String(e)))
      .finally(() => setUpdatingItemId(null))
  }

  const handleUpdateItemQuantityManual = (item: SpecificationItem, manual: number | null) => {
    if (selectedSpecId == null || isLinkedAssemblyItem(item)) return
    if (isWallInsulationItem(item) && !specDimsForm.double_timber) return
    const prev = item.quantity_manual
    const same =
      (prev == null && manual == null) ||
      (prev != null && manual != null && Math.abs(Number(prev) - manual) < 1e-9)
    if (same) return
    setUpdatingItemId(item.id)
    api.specifications
      .updateItem(selectedSpecId, item.id, { quantity_manual: manual })
      .then(async () => {
        await reloadCurrentSpecItems()
        loadSpecs()
      })
      .catch((e) => alert(e instanceof Error ? e.message : String(e)))
      .finally(() => setUpdatingItemId(null))
  }

  const toggleMaterialMaterialsRow = (item: SpecificationItem) => {
    if (item.template_id == null) return
    setExpandedMaterialItemIds((prev) =>
      prev.includes(item.id) ? prev.filter((x) => x !== item.id) : [...prev, item.id]
    )
  }

  const handleSelectRequiredMaterial = (item: SpecificationItem, nomenclatureId: number) => {
    if (selectedSpecId == null) return
    const specRow = specs.find((s) => s.id === selectedSpecId)
    if (specRow?.kp_approved === true) return
    if (item.nomenclature_item_id === nomenclatureId) return
    setUpdatingItemId(item.id)
    void api.specifications
      .updateItem(selectedSpecId, item.id, { nomenclature_item_id: nomenclatureId })
      .then((updated) => {
        setItems((prev) => prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)))
        loadSpecs()
      })
      .catch((e) => alert(e instanceof Error ? e.message : String(e)))
      .finally(() => setUpdatingItemId(null))
  }

  const handleAddItem = () => {
    if (selectedSpecId == null) return
    const nomId = addItemNomenclatureId === '' ? undefined : addItemNomenclatureId
    if (nomId == null && !nomenclature.length) {
      alert('Выберите позицию номенклатуры или загрузите номенклатуру.')
      return
    }
    if (nomId == null) {
      alert('Выберите позицию номенклатуры.')
      return
    }
    setAddingItem(true)
    const nom = nomenclature.find((n) => n.id === nomId)
    api.specifications
      .addItem(selectedSpecId, {
        nomenclature_item_id: nomId,
        quantity: addItemQuantity,
        unit: addItemUnit,
        price: addItemPrice,
        part_id: nom?.part_id ?? undefined,
      })
      .then((created) => {
        setItems((prev) => [...prev, created])
        loadSpecs()
        setShowAddItemModal(false)
      })
      .catch((e) => alert(e instanceof Error ? e.message : String(e)))
      .finally(() => setAddingItem(false))
  }

  const handleDeleteItem = (item: SpecificationItem) => {
    if (selectedSpecId == null) return
    if (!confirm(`Удалить позицию «${item.nomenclature_name ?? item.item_name}»?`)) return
    api.specifications
      .deleteItem(selectedSpecId, item.id)
      .then(() => {
        setItems((prev) => prev.filter((x) => x.id !== item.id))
        loadSpecs()
        if (editingItemId === item.id) setEditingItemId(null)
      })
      .catch((e) => alert(e instanceof Error ? e.message : String(e)))
  }

  const handleStartEditItem = (item: SpecificationItem) => {
    setEditingItemId(item.id)
    setEditForm({
      nomenclature_item_id: item.nomenclature_item_id ?? null,
      item_name: item.nomenclature_name ?? item.item_name ?? '',
      quantity: Number(item.quantity) ?? 0,
      unit: item.unit ?? 'шт',
      price: Number(item.price) ?? 0,
    })
    const partId = item.part_id ?? undefined
    api.nomenclatureItems.list({ part_id: partId, limit: 2000 }).then(setEditNomenclature).catch(() => setEditNomenclature([]))
  }

  const handleSaveEditItem = (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedSpecId == null || editingItemId == null) return
    setSavingItem(true)
    api.specifications
      .updateItem(selectedSpecId, editingItemId, {
        nomenclature_item_id: editForm.nomenclature_item_id ?? undefined,
        item_name: editForm.item_name.trim() || undefined,
        quantity: editForm.quantity,
        unit: editForm.unit,
        price: editForm.price,
      })
      .then((updated) => {
        setItems((prev) => prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)))
        loadSpecs()
        setEditingItemId(null)
        setEditNomenclature([])
      })
      .catch((err) => alert(err instanceof Error ? err.message : String(err)))
      .finally(() => setSavingItem(false))
  }

  const startEditProjectName = () => {
    if (!project) return
    setProjectNameDraft(project.name ?? '')
    setEditingProjectName(true)
  }

  const saveProjectName = () => {
    if (!Number.isFinite(id) || !editingProjectName) return
    const name = projectNameDraft.trim()
    setSavingProjectName(true)
    api.projects
      .update(id, { name: name || undefined })
      .then((updated) => {
        setProject(updated)
        setEditingProjectName(false)
      })
      .catch((e) => alert(e instanceof Error ? e.message : String(e)))
      .finally(() => setSavingProjectName(false))
  }

  if (!Number.isFinite(id)) {
    return (
      <div className="x_panel"><div className="x_content" style={{ color: '#73879C' }}>Неверный проект.</div></div>
    )
  }

  const selectedSpec = specs.find((s) => s.id === selectedSpecId)
  const kpApproved = selectedSpec?.kp_approved === true

  const parseOptionalFloat = (raw: string): number | null => {
    const t = raw.trim()
    if (t === '') return null
    const n = parseFloat(t.replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  const parseOptionalInt = (raw: string): number | null => {
    const t = raw.trim()
    if (t === '') return null
    const n = parseInt(t, 10)
    return Number.isFinite(n) ? n : null
  }

  const dimFloatEq = (a: number | null, b: number | null | undefined) => {
    if (a == null && (b == null || b === undefined)) return true
    if (a == null || b == null || b === undefined) return false
    return Math.abs(Number(a) - Number(b)) < 1e-6
  }
  const dimIntEq = (a: number | null, b: number | null | undefined) => {
    if (a == null && (b == null || b === undefined)) return true
    if (a == null || b == null || b === undefined) return false
    return Number(a) === Number(b)
  }

  /** Сохранить габариты на сервер, если отличаются от текущей спецификации; затем перезагрузить позиции (пересчёт qty_basis на бэкенде). */
  const commitSpecDimsIfChanged = (): Promise<boolean> => {
    if (selectedSpecId == null || selectedSpec == null || kpApproved) return Promise.resolve(false)
    const length_m = parseOptionalFloat(specDimsForm.length_m)
    const width_m = parseOptionalFloat(specDimsForm.width_m)
    const terrace_length_m = parseOptionalFloat(specDimsForm.terrace_length_m)
    const balcony_length_m = parseOptionalFloat(specDimsForm.balcony_length_m)
    const floors = parseOptionalInt(specDimsForm.floors)
    const room_count = parseOptionalInt(specDimsForm.room_count)
    const wall_height_m = parseOptionalFloat(specDimsForm.wall_height_m)
    const double_timber = specDimsForm.double_timber
    const unchanged =
      dimFloatEq(length_m, selectedSpec.length_m) &&
      dimFloatEq(width_m, selectedSpec.width_m) &&
      dimFloatEq(terrace_length_m, selectedSpec.terrace_length_m) &&
      dimFloatEq(balcony_length_m, selectedSpec.balcony_length_m) &&
      dimFloatEq(null, selectedSpec.terrace_width_m) &&
      dimIntEq(floors, selectedSpec.floors) &&
      dimIntEq(room_count, selectedSpec.room_count) &&
      dimFloatEq(wall_height_m, selectedSpec.wall_height_m ?? QTY_BASIS_WALL_HEIGHT_K_M) &&
      double_timber === Boolean(selectedSpec.double_timber)
    if (unchanged) return Promise.resolve(false)
    return api.specifications
      .update(selectedSpecId, {
        length_m,
        width_m,
        terrace_length_m,
        balcony_length_m,
        terrace_width_m: null,
        floors,
        room_count,
        wall_height_m,
        double_timber,
      })
      .then(async () => {
        await reloadCurrentSpecItems()
        if (Number.isFinite(id)) {
          const all = await api.specifications.list({ project_id: id })
          setSpecs(all)
        }
        return true
      })
  }

  const handleSpecDimsFieldBlur = () => {
    void commitSpecDimsIfChanged().catch((e) => alert(e instanceof Error ? e.message : String(e)))
  }

  const houseLengthM = parseOptionalFloat(specDimsForm.length_m)
  const houseWidthM = parseOptionalFloat(specDimsForm.width_m)
  const terraceLengthM = parseOptionalFloat(specDimsForm.terrace_length_m)
  const floorsM = parseOptionalInt(specDimsForm.floors)
  const roomCountM = parseOptionalInt(specDimsForm.room_count)
  const wallHeightM = parseOptionalFloat(specDimsForm.wall_height_m)
  const housePerimeterM = calcRectPerimeter(houseLengthM, houseWidthM)
  const houseAreaM2 = calcRectArea(houseLengthM, houseWidthM)
  const terraceAreaM2 = calcTerraceAreaM2(
    houseWidthM,
    terraceLengthM,
    specDimsForm.terrace_second_floor,
  )
  const kitLengthM = calcKitSide(houseLengthM, terraceLengthM)
  const kitWidthM = houseWidthM
  const kitPerimeterM = calcRectPerimeter(kitLengthM, kitWidthM)
  const kitAreaM2 = calcRectArea(kitLengthM, kitWidthM)
  const kitWallAreaM2 = calcKitWallAreaM2(kitPerimeterM, wallHeightM, specDimsForm.double_timber, floorsM)
  const roomWallsLengthM = calcRoomWallsLengthM(
    houseLengthM,
    houseWidthM,
    roomCountM,
    specDimsForm.double_timber,
  )
  const roomWallsAreaM2 = calcRoomWallsAreaM2(
    houseLengthM,
    houseWidthM,
    roomCountM,
    specDimsForm.double_timber,
    wallHeightM,
  )

  const recalcPrepaymentAndBalance = (d: ProjectContractData) => {
    const total = d.contract_supply_amount != null ? Number(d.contract_supply_amount) : undefined
    const newPrepayment = total != null ? Math.round(total * 0.5 * 100) / 100 : undefined
    const newBalance = total != null && newPrepayment != null ? Math.round((total - newPrepayment) * 100) / 100 : undefined
    setContractDataForm((f) => ({
      ...f,
      prepayment_amount: newPrepayment ?? f.prepayment_amount,
      balance_amount: newBalance ?? f.balance_amount,
    }))
    if (newPrepayment != null) {
      api.amountToWords(newPrepayment).then((r) => setContractDataForm((f) => ({ ...f, prepayment_words: r.words })))
    }
    if (newBalance != null) {
      api.amountToWords(newBalance).then((r) => setContractDataForm((f) => ({ ...f, balance_words: r.words })))
    }
  }

  const saveKpInternalComment = () => {
    if (selectedSpecId == null || selectedSpec == null) return
    const trimmed = kpInternalComment.trim()
    const prev = (selectedSpec.kp_internal_comment ?? '').trim()
    if (trimmed === prev) return
    setSavingKpComment(true)
    api.specifications
      .update(selectedSpecId, { kp_internal_comment: trimmed || null })
      .then(() => loadSpecs())
      .catch((e) => alert(e instanceof Error ? e.message : String(e)))
      .finally(() => setSavingKpComment(false))
  }

  const saveSpecComment = () => {
    if (selectedSpecId == null || selectedSpec == null) return
    const trimmed = specComment.trim()
    const prev = (selectedSpec.comment ?? '').trim()
    if (trimmed === prev) return
    setSavingSpecComment(true)
    api.specifications
      .update(selectedSpecId, { comment: trimmed || null })
      .then(() => loadSpecs())
      .catch((e) => alert(e instanceof Error ? e.message : String(e)))
      .finally(() => setSavingSpecComment(false))
  }

  const handleApproveKp = () => {
    if (selectedSpecId == null) return
    setUpdatingKp(true)
    api.specifications
      .update(selectedSpecId, { kp_approved: true })
      .then(() => {
        loadSpecs()
        setEditingItemId(null)
        if (Number.isFinite(id)) {
          api.projects.getContractData(id).then((d) => {
            setContractData(d)
            setContractDataForPlaceholders(d)
            recalcPrepaymentAndBalance(d)
          }).catch(() => {})
        }
      })
      .catch((e) => alert(e instanceof Error ? e.message : String(e)))
      .finally(() => setUpdatingKp(false))
  }

  const handleUnapproveKp = () => {
    if (selectedSpecId == null) return
    setUpdatingKp(true)
    api.specifications
      .update(selectedSpecId, { kp_approved: false })
      .then(() => {
        loadSpecs()
        if (Number.isFinite(id)) {
          api.projects.getContractData(id).then((d) => {
            setContractData(d)
            setContractDataForPlaceholders(d)
            recalcPrepaymentAndBalance(d)
          }).catch(() => {})
        }
      })
      .catch((e) => alert(e instanceof Error ? e.message : String(e)))
      .finally(() => setUpdatingKp(false))
  }

  /** Загрузка вкладки «Данные» (договор + клиент). preserveCustomerForm — не затирать несохранённую форму клиента. */
  const loadContractDataPanel = useCallback(
    (options?: { preserveCustomerForm?: boolean }) => {
      if (!Number.isFinite(id)) return
      const preserveCustomer = options?.preserveCustomerForm ?? false
      const prevCustomerForm = preserveCustomer ? contractModalCustomerFormRef.current : {}
      setContractDataLoading(true)
      if (!preserveCustomer) {
        setContractData(null)
        setContractDataForm({})
        setContractModalCustomer(null)
        setContractModalCustomerForm({})
      }
      const customerPromise =
        project?.customer_id != null
          ? api.customers.get(project.customer_id).catch(() => null)
          : Promise.resolve(null)
      Promise.all([api.projects.getContractData(id), customerPromise])
        .then(([d, c]) => {
          setContractData(d)
          const total = d.contract_supply_amount != null ? Number(d.contract_supply_amount) : undefined
          const prepayment =
            d.prepayment_amount != null
              ? Number(d.prepayment_amount)
              : total != null
                ? Math.round(total * 0.5 * 100) / 100
                : undefined
          const balance =
            d.balance_amount != null
              ? Number(d.balance_amount)
              : total != null && prepayment != null
                ? Math.round((total - prepayment) * 100) / 100
                : undefined
          const party = (d.buyer_party_type === 'legal' ? 'legal' : 'individual') as 'individual' | 'legal'
          const formFromApi: ProjectContractDataUpdate = {
            contract_date: d.contract_date ?? undefined,
            city: d.city ?? undefined,
            prepayment_amount: prepayment,
            prepayment_words: d.prepayment_words ?? undefined,
            balance_amount: balance,
            balance_words: d.balance_words ?? undefined,
            delivery_deadline: d.delivery_deadline ?? undefined,
            buyer_party_type: party,
          }
          if (preserveCustomer) {
            setContractDataForm((f) => {
              const merged = {
                ...formFromApi,
                ...f,
                buyer_party_type: f.buyer_party_type ?? formFromApi.buyer_party_type,
              }
              const tabParty = merged.buyer_party_type === 'legal' ? 'legal' : 'individual'
              setContractCustomerPartyTab(tabParty)
              return merged
            })
          } else {
            setContractDataForm(formFromApi)
            setContractCustomerPartyTab(party)
          }
          if (c) {
            setContractModalCustomer(c)
            setCustomerForPlaceholders(c)
            if (preserveCustomer) {
              setContractModalCustomerForm(mergeContractFormAfterSave(prevCustomerForm, c))
            } else {
              setContractModalCustomerForm(customerToContractForm(c))
            }
          } else if (!preserveCustomer) {
            setContractModalCustomer(null)
            setContractModalCustomerForm({})
          }
          const draft = readContractDraft(id)
          if (draft) {
            setContractDataForm((f) => ({
              ...f,
              ...draft.contractDataForm,
              buyer_party_type:
                draft.contractDataForm.buyer_party_type ?? f.buyer_party_type,
            }))
            setContractCustomerPartyTab(draft.contractCustomerPartyTab)
            setContractModalCustomerForm((f) =>
              c
                ? mergeContractFormAfterSave(draft.contractModalCustomerForm, c)
                : { ...f, ...draft.contractModalCustomerForm },
            )
          }
          if (prepayment != null && !d.prepayment_words) {
            api.amountToWords(prepayment).then((r) => setContractDataForm((f) => ({ ...f, prepayment_words: r.words })))
          }
          if (balance != null && !d.balance_words) {
            api.amountToWords(balance).then((r) => setContractDataForm((f) => ({ ...f, balance_words: r.words })))
          }
        })
        .catch(() => {
          if (!preserveCustomer) {
            setContractData(null)
            setContractDataForm({})
            setContractModalCustomer(null)
            setContractModalCustomerForm({})
          }
        })
        .finally(() => setContractDataLoading(false))
    },
    [id, project?.customer_id]
  )

  /** Сохранить «Данные договора» и клиента в БД (без alert). */
  const flushContractPanelSave = useCallback(async (): Promise<void> => {
    if (!Number.isFinite(id)) return
    // state, не только ref — ref может отставать на один кадр после ввода
    const formSnapshot = { ...contractModalCustomerFormRef.current, ...contractModalCustomerForm }
    const contractSnapshot = { ...contractDataFormRef.current, ...contractDataForm }
    const customerPatch = {
      ...commonPatchFromForm(formSnapshot),
      ...individualPatchFromForm(formSnapshot),
      ...legalPatchFromForm(formSnapshot),
    }
    const { buyer_legal_json: _omitLegalJson, ...contractPatch } = contractSnapshot as ProjectContractDataUpdate & {
      buyer_legal_json?: unknown
    }
    if (project?.customer_id != null && Object.keys(customerPatch).length > 0) {
      const updatedCustomer = await api.customers.update(project.customer_id, customerPatch as any)
      setContractModalCustomer(updatedCustomer)
      setCustomerForPlaceholders(updatedCustomer)
      setContractModalCustomerForm(mergeContractFormAfterSave(formSnapshot, updatedCustomer))
    }
    if (Object.keys(contractPatch).length > 0) {
      const updated = await api.projects.updateContractData(id, contractPatch)
      setContractDataForPlaceholders(updated)
      setContractData(updated)
      const party = updated.buyer_party_type === 'legal' ? 'legal' : 'individual'
      setContractCustomerPartyTab(party)
      setContractDataForm((f) => ({ ...f, buyer_party_type: party }))
    }
  }, [id, project?.customer_id, contractModalCustomerForm, contractDataForm])

  const flushContractPanelSaveRef = useRef(flushContractPanelSave)
  useEffect(() => {
    flushContractPanelSaveRef.current = flushContractPanelSave
  }, [flushContractPanelSave])

  useEffect(() => {
    return () => {
      if (!Number.isFinite(id)) return
      writeContractDraft(id, {
        contractDataForm: contractDataFormRef.current,
        contractModalCustomerForm: contractModalCustomerFormRef.current,
        contractCustomerPartyTab:
          contractDataFormRef.current.buyer_party_type === 'legal' ? 'legal' : 'individual',
      })
      void flushContractPanelSaveRef.current()
    }
  }, [id])

  const revokeContractPdfBlobUrl = useCallback(() => {
    if (contractPdfBlobUrlRef.current) {
      URL.revokeObjectURL(contractPdfBlobUrlRef.current)
      contractPdfBlobUrlRef.current = null
    }
    setContractPdfBlobUrl(null)
  }, [])

  const fetchContractPdfBlob = useCallback(
    async (
      docId: ContractDocumentId,
      opts?: {
        project?: Project | null
        htmlBody?: string | null
        contractData?: ProjectContractDataUpdate
      }
    ) => {
      if (!Number.isFinite(id)) throw new Error('Некорректный проект')
      const p = opts?.project ?? project
      const html =
        opts?.htmlBody !== undefined
          ? opts.htmlBody?.trim()
            ? opts.htmlBody
            : null
          : contractPdfHtmlBody(contractDocumentsHtml[docId], templateContent)
      return api.projects.contractDocumentPdf(id, {
        document_id: docId,
        contract_data: opts?.contractData ?? contractDataForm,
        customer: contractModalCustomerForm as Record<string, unknown>,
        specification_id: selectedSpecId ?? undefined,
        html_body: html,
        filename: p?.name ? `dogovor_${p.name}_${docId}` : undefined,
      })
    },
    [id, contractDataForm, contractModalCustomerForm, selectedSpecId, templateContent, contractDocumentsHtml, project]
  )

  const loadContractPdfPreview = useCallback(
    async (
      docId?: ContractDocumentId,
      opts?: {
        project?: Project | null
        htmlBody?: string | null
        contractData?: ProjectContractDataUpdate
      }
    ) => {
      const doc = docId ?? activeContractDocumentId
      if (!Number.isFinite(id) || !doc) return
      setContractPdfLoading(true)
      setContractPdfError(null)
      revokeContractPdfBlobUrl()
      try {
        const blob = await fetchContractPdfBlob(doc, opts)
        const url = URL.createObjectURL(blob)
        contractPdfBlobUrlRef.current = url
        setContractPdfBlobUrl(url)
      } catch (e) {
        setContractPdfError(e instanceof Error ? e.message : String(e))
      } finally {
        setContractPdfLoading(false)
      }
    },
    [id, activeContractDocumentId, fetchContractPdfBlob, revokeContractPdfBlobUrl]
  )

  /** HTML документа из project_contract_documents (+ sync из шаблона, если пусто). */
  const loadProjectDocumentHtml = useCallback(
    async (docId: ContractDocumentId): Promise<{ html: string }> => {
      if (!Number.isFinite(id)) throw new Error('Некорректный проект')
      let row = await api.projects.getContractDocument(id, docId)
      let html = (row.html_body ?? '').trim()
      if (!html) {
        try {
          if (docId === 'supply_contract') {
            const party = resolveBuyerPartyType()
            await api.projects.updateContractData(id, { buyer_party_type: party })
          }
          await api.projects.syncContractDocuments(id, { document_id: docId })
          row = await api.projects.getContractDocument(id, docId)
          html = (row.html_body ?? '').trim()
        } catch {
          /* пустой документ */
        }
      }
      setContractDocumentsHtml((prev) => ({ ...prev, [docId]: html }))
      return { html }
    },
    [id, resolveBuyerPartyType]
  )

  useEffect(() => {
    return () => revokeContractPdfBlobUrl()
  }, [revokeContractPdfBlobUrl])

  const downloadContractPdf = useCallback(
    async (docId: ContractDocumentId) => {
      if (!Number.isFinite(id)) return
      setDownloadingContractPdf(true)
      try {
        const blob = await fetchContractPdfBlob(docId)
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = project?.name ? `dogovor_${project.name}_${docId}.pdf` : `dogovor_${docId}.pdf`
        a.click()
        URL.revokeObjectURL(url)
      } catch (e) {
        alert(e instanceof Error ? e.message : String(e))
      } finally {
        setDownloadingContractPdf(false)
      }
    },
    [id, fetchContractPdfBlob, project?.name]
  )

  const renderContractPdfPreview = () => (
    <div
      style={{
        flex: 1,
        minHeight: 430,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        justifyContent: 'center',
      }}
    >
      {contractPdfLoading ? (
        <p style={{ color: '#73879C', fontSize: 13, textAlign: 'center' }}>Формирование PDF…</p>
      ) : contractPdfError ? (
        <p style={{ color: '#c0392b', fontSize: 13, padding: 12 }}>{contractPdfError}</p>
      ) : contractPdfBlobUrl ? (
        <iframe
          title="PDF договора"
          src={contractPdfBlobUrl}
          style={{
            flex: 1,
            border: '1px solid #ccc',
            borderRadius: 4,
            minHeight: 430,
            width: '100%',
            background: '#fff',
          }}
        />
      ) : (
        <p style={{ color: '#73879C', fontSize: 13, textAlign: 'center' }}>
          Нажмите «Результат» для обновления предпросмотра PDF.
        </p>
      )}
    </div>
  )

  const applyContractTemplateBody = useCallback(
    async (
      body: string,
      opts: {
        documentId?: ContractDocumentId | null
        orgMode: 'supply' | 'mount'
        contractDataPatch?: ProjectContractDataUpdate
      }
    ) => {
      if (!Number.isFinite(id) || !project) return
      if (!contractDataForPlaceholders && Number.isFinite(id)) {
        try {
          const d = await api.projects.getContractData(id)
          setContractDataForPlaceholders(d)
          setContractData(d)
        } catch {
          /* use form only */
        }
      }
      if (!customerForPlaceholders && !contractModalCustomer && project.customer_id) {
        try {
          const c = await api.customers.get(project.customer_id)
          setCustomerForPlaceholders(c)
          setContractModalCustomer(c)
        } catch {
          /* use form only */
        }
      }
      if (opts.documentId) {
        await api.projects.updateContractDocument(id, opts.documentId, { html_body: body })
        setContractDocumentsHtml((prev) => ({ ...prev, [opts.documentId!]: body }))
      }
      let contractDataForPdf = contractDataForm
      if (opts.contractDataPatch && Number.isFinite(id)) {
        contractDataForPdf = { ...contractDataForm, ...opts.contractDataPatch }
        try {
          const updated = await api.projects.updateContractData(id, opts.contractDataPatch)
          setContractData(updated)
          setContractDataForPlaceholders(updated)
          contractDataForPdf = {
            ...contractDataForm,
            ...opts.contractDataPatch,
            buyer_party_type: updated.buyer_party_type ?? opts.contractDataPatch.buyer_party_type,
          }
          setContractDataForm((f) => ({ ...f, ...opts.contractDataPatch }))
          const party = updated.buyer_party_type === 'legal' ? 'legal' : 'individual'
          setContractCustomerPartyTab(party)
        } catch {
          /* preview uses merged patch */
        }
      }
      setTemplateContent(decodeHtmlEntities(body))
      setContractDocumentEditorTab('result')
      await loadContractPdfPreview(opts.documentId ?? undefined, {
        htmlBody: body,
        contractData: contractDataForPdf,
      })
    },
    [id, project, contractDataForm, contractDataForPlaceholders, customerForPlaceholders, contractModalCustomer, loadContractPdfPreview]
  )

  /** Шаблон dogovor_postavki_fiz / dogovor_postavki_ur → документ supply_contract. */
  const fillSupplyContractForParty = useCallback(
    async (party: 'individual' | 'legal') => {
      if (!Number.isFinite(id) || !project) return
      const cfg = SUPPLY_CONTRACT_TEMPLATES[party]
      const template = await api.contractTemplates.getByCode(cfg.code)
      const body = template.body ?? ''
      if (!body.trim()) {
        throw new Error(`Шаблон «${cfg.label}» (${cfg.code}) пуст`)
      }
      await applyContractTemplateBody(body, {
        documentId: 'supply_contract',
        orgMode: 'supply',
        contractDataPatch: { buyer_party_type: party },
      })
    },
    [id, project, applyContractTemplateBody]
  )

  const onBuyerPartyTypeChange = useCallback(
    async (party: 'individual' | 'legal') => {
      setContractDataForm((f) => ({ ...f, buyer_party_type: party }))
      setContractCustomerPartyTab(party)
      if (!Number.isFinite(id)) return
      try {
        const updated = await api.projects.updateContractData(id, { buyer_party_type: party })
        setContractData(updated)
        setContractDataForPlaceholders(updated)
      } catch {
        /* preview uses form */
      }
      try {
        await fillSupplyContractForParty(party)
      } catch (e) {
        alert(e instanceof Error ? e.message : String(e))
      }
    },
    [id, fillSupplyContractForParty]
  )

  const fillFromSupplyContractTemplate = useCallback(
    async (party: 'individual' | 'legal') => {
      setFillTemplateMenuOpen(false)
      setContractDataForm((f) => ({ ...f, buyer_party_type: party }))
      setContractCustomerPartyTab(party)
      try {
        if (Number.isFinite(id)) {
          const updated = await api.projects.updateContractData(id, { buyer_party_type: party })
          setContractData(updated)
          setContractDataForPlaceholders(updated)
        }
        await fillSupplyContractForParty(party)
      } catch (e) {
        alert(e instanceof Error ? e.message : String(e))
      }
    },
    [id, fillSupplyContractForParty]
  )

  const openDocumentEditor = useCallback(
    async (docId: ContractDocumentId) => {
      if (!Number.isFinite(id)) return
      setActiveContractDocumentId(docId)
      setContractDataModalTab('documents')
      setContractTab('data')
      setContractDocumentEditorTab('result')

      let contractDataSnapshot = contractDataForPlaceholders ?? contractData
      if (!contractDataSnapshot) {
        try {
          contractDataSnapshot = await api.projects.getContractData(id)
          setContractDataForPlaceholders(contractDataSnapshot)
          setContractData(contractDataSnapshot)
        } catch {
          /* form only */
        }
      }
      const customerId = project?.customer_id
      if (!customerForPlaceholders && !contractModalCustomer && customerId) {
        try {
          const c = await api.customers.get(customerId)
          setCustomerForPlaceholders(c)
          setContractModalCustomer(c)
          if (Object.keys(contractModalCustomerForm).length === 0) {
            setContractModalCustomerForm(customerToContractForm(c))
          }
        } catch {
          /* form only */
        }
      }

      if (docId === 'supply_contract') {
        const party = resolveBuyerPartyType(contractDataSnapshot)
        setContractCustomerPartyTab(party)
        const row = await api.projects.getContractDocument(id, docId)
        const existing = (row.html_body ?? '').trim()
        if (!existing) {
          try {
            await fillSupplyContractForParty(party)
          } catch (e) {
            alert(e instanceof Error ? e.message : String(e))
          }
          return
        }
      }

      const { html } = await loadProjectDocumentHtml(docId)
      const decoded = decodeHtmlEntities(html)
      setTemplateContent(decoded)
      await loadContractPdfPreview(docId, { htmlBody: html })
    },
    [
      id,
      project?.customer_id,
      contractDataForPlaceholders,
      contractModalCustomer,
      contractModalCustomerForm,
      customerForPlaceholders,
      loadProjectDocumentHtml,
      loadContractPdfPreview,
      resolveBuyerPartyType,
      fillSupplyContractForParty,
    ]
  )

  const fillActiveDocumentFromTemplate = useCallback(async () => {
    if (!Number.isFinite(id) || !project || !activeContractDocumentId) return
    if (activeContractDocumentId === 'supply_contract') {
      return
    }
    const templateCode =
      activeContractDocumentId === 'mount_contract'
        ? 'mount'
        : appendixTemplateCode(activeContractDocumentId)
    if (!templateCode) return
    try {
      const template = await api.contractTemplates.getByCode(templateCode)
      const body = template.body ?? ''
      const mountDoc = activeContractDocumentId === 'mount_contract' || activeContractDocumentId === 'mount_works_act'
      await applyContractTemplateBody(body, {
        documentId: activeContractDocumentId,
        orgMode: mountDoc ? 'mount' : 'supply',
      })
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    }
  }, [id, project, activeContractDocumentId, applyContractTemplateBody])

  const refreshContractDocumentResult = useCallback(async () => {
    if (!Number.isFinite(id) || !activeContractDocumentId) return
    try {
      const contractPayload = {
        ...contractDataForm,
      }
      await api.projects.updateContractData(id, contractPayload)
    } catch {
      /* preview uses form even if save failed */
    }
    const { html } = await loadProjectDocumentHtml(activeContractDocumentId)
    setTemplateContent(decodeHtmlEntities(html))
    setContractDocumentEditorTab('result')
    await loadContractPdfPreview(activeContractDocumentId, { htmlBody: html })
  }, [
    id,
    activeContractDocumentId,
    contractDataForm,
    contractModalCustomerForm,
    loadProjectDocumentHtml,
    loadContractPdfPreview,
  ])

  /** Вкладка «Данные для договора» (список документов или форма). */
  const openContractDataTab = useCallback(
    async (subTab: 'documents' | 'contract' = 'documents') => {
      if (!Number.isFinite(id)) return
      const hasDraft =
        contractTab === 'data' ||
        Object.keys(contractModalCustomerFormRef.current).length > 0 ||
        Object.keys(contractDataFormRef.current).length > 0
      if (hasDraft) {
        await flushContractPanelSave()
      }
      setContractTab('data')
      setContractDataModalTab(subTab)
      setActiveContractDocumentId(null)
      loadContractDataPanel()
    },
    [id, loadContractDataPanel, contractTab, flushContractPanelSave]
  )

  const printProjectDocument = useCallback(
    async (docId: ContractDocumentId) => {
      if (!Number.isFinite(id)) return
      setPrintingDocumentId(docId)
      try {
        const blob = await fetchContractPdfBlob(docId)
        const url = URL.createObjectURL(blob)
        const w = window.open(url, '_blank')
        if (!w) {
          URL.revokeObjectURL(url)
          alert('Разрешите всплывающие окна для печати PDF.')
          return
        }
        w.addEventListener(
          'load',
          () => {
            w.focus()
            w.print()
          },
          { once: true }
        )
        setTimeout(() => URL.revokeObjectURL(url), 120_000)
      } catch (e) {
        alert(e instanceof Error ? e.message : String(e))
      } finally {
        setPrintingDocumentId(null)
      }
    },
    [id, fetchContractPdfBlob]
  )

  const renderPhotosTab = () => {
    if (selectedSpecId == null) return null
    return (
      <div style={{ padding: 16 }}>
        <input
          ref={photoInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files) void handleUploadPhotos(e.target.files)
            e.target.value = ''
          }}
        />
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setPhotoDropActive(true)
          }}
          onDragLeave={() => setPhotoDropActive(false)}
          onDrop={(e) => {
            e.preventDefault()
            setPhotoDropActive(false)
            if (e.dataTransfer.files?.length) void handleUploadPhotos(e.dataTransfer.files)
          }}
          style={{
            marginBottom: 16,
            padding: '20px 16px',
            border: `2px dashed ${photoDropActive ? '#1ABB9C' : '#D9DEE4'}`,
            borderRadius: 8,
            background: photoDropActive ? '#F0FBF8' : '#FAFBFC',
            textAlign: 'center',
          }}
        >
          <p style={{ margin: '0 0 10px 0', color: '#73879C', fontSize: 13 }}>
            Перетащите сюда несколько фото или выберите файлы на компьютере
          </p>
          <button
            type="button"
            className="btn btn-success"
            disabled={uploadingPhoto}
            onClick={() => photoInputRef.current?.click()}
          >
            {uploadingPhoto ? 'Загрузка…' : '+ Добавить фото'}
          </button>
          <p style={{ margin: '10px 0 0 0', color: '#A0A8B0', fontSize: 12 }}>
            JPEG, PNG, GIF, WebP · до 10 МБ · до 50 файлов за раз
          </p>
        </div>
        {specPhotosLoading ? (
          <p style={{ color: '#73879C', fontSize: 13 }}>Загрузка фото…</p>
        ) : specPhotos.length === 0 ? (
          <p style={{ color: '#73879C', fontSize: 13 }}>Нет фотографий</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {specPhotos.map((photo) => (
              <div key={photo.id} style={{ position: 'relative', width: 180, height: 180, borderRadius: 6, overflow: 'hidden', border: '1px solid #E6E9ED', background: '#f8f9fa' }}>
                <img
                  src={api.specificationPhotos.imageUrl(photo.id)}
                  alt={photo.filename ?? 'Фото'}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); void handleDeletePhoto(photo.id) }}
                  style={{
                    position: 'absolute', top: 4, right: 4,
                    width: 26, height: 26, borderRadius: '50%',
                    background: 'rgba(0,0,0,0.55)', color: '#fff',
                    border: 'none', cursor: 'pointer', fontSize: 15,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    lineHeight: 1,
                  }}
                  title="Удалить"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const renderRightColumnContent = () => {
    if (selectedSpecId == null && !showTemplatePicker) {
      return <p className="p-6 text-center text-slate-500 text-sm">Выберите спецификацию слева</p>
    }
    if (showTemplatePicker) {
      if (templatesLoading) return <p className="p-4 text-slate-500 text-sm">Загрузка шаблонов…</p>
      if (applyingTemplate) return <p className="p-4 text-slate-500 text-sm">Добавление позиций…</p>
      if (templates.length === 0) return <p className="p-6 text-center text-slate-500 text-sm">Нет шаблонов спецификации домов</p>
      return (
        <table className="table w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-3 py-1.5 text-xs font-medium text-slate-500 uppercase w-16">ID</th>
              <th className="px-3 py-1.5 text-xs font-medium text-slate-500 uppercase">Название</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {templates.map((t) => (
              <tr
                key={t.id}
                className="hover:bg-slate-50/50 cursor-pointer"
                onClick={() => handleSelectTemplate(t.id)}
              >
                <td className="px-3 py-1.5 text-sm text-slate-600 tabular-nums">{t.id}</td>
                <td className="px-3 py-1.5 text-sm font-medium text-slate-800">{t.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )
    }

    if (specTab === 'photos') {
      return renderPhotosTab()
    }

    if (itemsLoading) return <p className="p-4 text-slate-500 text-sm">Загрузка позиций…</p>

    if (items.length === 0) {
      return <p className="p-6 text-center text-slate-500 text-sm">Нет позиций в этой спецификации</p>
    }
    const colCount = kpApproved ? 11 : 12
    const materialNomLabel = (nomenclatureId: number) => {
      const n = nomenclature.find((x) => x.id === nomenclatureId)
      if (!n) return `#${nomenclatureId}`
      const num = n.item_number ?? ''
      const name = (n.name ?? '').trim()
      return name ? `${num} ${name}` : (num || `#${nomenclatureId}`)
    }
    return (
      <table className="table table-striped" style={{ marginBottom: 0 }}>
        <thead>
          <tr>
            <th style={{ width: 36 }} title="Допустимые материалы по шаблону обязательной позиции" />
            <th style={{ width: 52 }} title="Включить позицию в общую сумму (строки 19–22 шаблона)">
              В сумме
            </th>
            <th style={{ width: 60 }}>№</th>
            <th>Название</th>
            <th>Шаблон обязательных позиций</th>
            <th style={{ width: 150 }} title="Авто-расчёт и ручное значение в одном столбце. Пусто в «Вручную» = используется «Авто».">
              Авто / Вручную
            </th>
            <th style={{ width: 90 }} title="Итоговое количество (не редактируется в таблице)">Кол-во</th>
            <th style={{ width: 60 }}>Ед.</th>
            <th style={{ width: 100 }}>Цена</th>
            <th style={{ width: 90 }}>Скидка, %</th>
            <th style={{ width: 100 }}>Итого</th>
            {!kpApproved && (
              <th style={{ width: 120 }}>Действия</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {(() => {
            let rowNum = 0
            return partOrder.map((partKey) => {
              const partItems = itemsByPart.get(partKey) ?? []
              if (partItems.length === 0) return null
              const partName = partKey === 'none' ? 'Без части' : (getPartName(partKey) ?? `Часть #${partKey}`)
              return (
                <React.Fragment key={partKey === 'none' ? 'none' : partKey}>
                  <tr>
                    <td colSpan={colCount} className="px-3 py-1.5 bg-slate-100 text-slate-700 font-medium text-sm" style={{ borderBottom: '1px solid #e2e8f0' }}>
                      {partName}
                    </td>
                  </tr>
                  {partItems.map((i) => {
                    rowNum++
                    const isUpdating = updatingItemId === i.id
                    const tid = i.template_id
                    const mats = tid != null ? materialsByTemplateId[tid] : undefined
                    const matStatus = tid != null ? materialsFetchStatus[tid] : undefined
                    const materialsExpanded = tid != null && expandedMaterialItemIds.includes(i.id)
                    const optionalTotalLine = isOptionalTotalTemplateLine(i.template_line_no)
                    const excludedFromTotal = optionalTotalLine && !i.include_in_total
                    const wallInsulationInactive =
                      isWallInsulationItem(i) && !specDimsForm.double_timber
                    const rowStyle = wallInsulationInactive
                      ? { backgroundColor: '#e5e7eb', color: '#6b7280', borderLeft: '3px solid #9ca3af' }
                      : excludedFromTotal
                        ? { backgroundColor: '#fef2f2', borderLeft: '3px solid #ef4444' }
                        : undefined
                    return (
                    <React.Fragment key={i.id}>
                    <tr
                      className={rowStyle ? '' : 'hover:bg-slate-50/50'}
                      style={rowStyle}
                      title={
                        wallInsulationInactive
                          ? 'Утепление стен: включите «Двойной брус» в габаритах спецификации'
                          : excludedFromTotal
                            ? 'Не учитывается в общей сумме'
                            : undefined
                      }
                    >
                      <td className="px-1 py-1.5 text-center align-top">
                        {tid != null ? (
                          <button
                            type="button"
                            className="text-slate-500 hover:text-primary-600 p-1 leading-none"
                            title={materialsExpanded ? 'Скрыть материалы' : 'Выбор материала по шаблону'}
                            aria-expanded={materialsExpanded}
                            onClick={() => toggleMaterialMaterialsRow(i)}
                          >
                            {materialsExpanded ? '▼' : '▶'}
                          </button>
                        ) : null}
                      </td>
                      <td className="px-1 py-1.5 text-center align-top">
                        {optionalTotalLine ? (
                          <input
                            type="checkbox"
                            checked={Boolean(i.include_in_total)}
                            disabled={kpApproved || isUpdating}
                            title={
                              i.include_in_total
                                ? 'Учитывается в общей сумме'
                                : 'Не учитывается в общей сумме (строка выделена)'
                            }
                            onChange={(e) => handleUpdateItemIncludeInTotal(i, e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                          />
                        ) : null}
                      </td>
                      <td className="px-3 py-1.5 text-sm text-slate-600 tabular-nums" title={i.template_line_no != null ? `Строка шаблона ${i.template_line_no}` : undefined}>
                        {i.template_line_no ?? rowNum}
                      </td>
                      <td className="px-3 py-1.5 text-sm font-medium text-slate-800 w-[600px] max-w-[600px] break-words whitespace-normal align-top">{i.nomenclature_name ?? i.item_name}</td>
                      <td className="px-3 py-1.5 text-sm text-slate-600">
                        {i.template_id != null ? (
                          <Link to={`/settings/required-item-templates/${i.template_id}/edit`} className="text-primary-500 hover:underline">
                            {requiredItemTemplates.find((t) => t.id === i.template_id)?.name ?? i.template_id}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-3 py-1.5">
                        <div className="flex flex-col gap-1">
                          <div className="text-xs text-slate-500 tabular-nums">
                            Авто: {i.qty_basis ? formatQtyAuto(i.quantity_auto) : '—'}
                          </div>
                          {kpApproved ? (
                            <div className="text-sm text-slate-600 tabular-nums">
                              Вручную: {i.qty_basis
                                ? i.quantity_manual != null
                                  ? formatQtyAuto(i.quantity_manual)
                                  : '—'
                                : formatQtyAuto(i.quantity)}
                            </div>
                          ) : isLinkedAssemblyItem(i) || wallInsulationInactive ? (
                            <span
                              className="text-sm text-slate-500 tabular-nums"
                              title={
                                wallInsulationInactive
                                  ? 'Недоступно без «Двойной брус»'
                                  : 'Совпадает с количеством 3-й позиции шаблона, редактирование отключено'
                              }
                            >
                              Вручную: —
                            </span>
                          ) : i.qty_basis ? (
                            <input
                              key={`manual-${i.id}-${i.quantity_manual ?? 'x'}-${i.quantity_auto ?? 'x'}`}
                              type="text"
                              inputMode="decimal"
                              defaultValue={i.quantity_manual != null ? String(i.quantity_manual) : ''}
                              onBlur={(e) => {
                                const t = (e.target as HTMLInputElement).value.trim()
                                if (t === '') {
                                  handleUpdateItemQuantityManual(i, null)
                                  return
                                }
                                const v = parseFloat(t.replace(',', '.'))
                                if (!Number.isFinite(v) || v < 0) {
                                  alert('Введите неотрицательное число или оставьте поле пустым для подстановки авто.')
                                  ;(e.target as HTMLInputElement).value =
                                    i.quantity_manual != null ? String(i.quantity_manual) : ''
                                  return
                                }
                                handleUpdateItemQuantityManual(i, v)
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                              }}
                              disabled={isUpdating || wallInsulationInactive}
                              placeholder="Вручную"
                              className="w-full max-w-[7rem] rounded border border-slate-300 px-2 py-1 text-sm tabular-nums focus:ring-1 focus:ring-primary-500 focus:border-primary-500 disabled:bg-slate-100 disabled:text-slate-400"
                            />
                          ) : (
                            <input
                              key={`manual-plain-${i.id}-${i.quantity ?? 'x'}`}
                              type="text"
                              inputMode="decimal"
                              defaultValue={i.quantity != null ? String(i.quantity) : ''}
                              onBlur={(e) => {
                                const t = (e.target as HTMLInputElement).value.trim()
                                if (t === '') {
                                  ;(e.target as HTMLInputElement).value =
                                    i.quantity != null ? String(i.quantity) : ''
                                  return
                                }
                                const v = parseFloat(t.replace(',', '.'))
                                if (!Number.isFinite(v) || v < 0) {
                                  alert('Введите неотрицательное число.')
                                  ;(e.target as HTMLInputElement).value =
                                    i.quantity != null ? String(i.quantity) : ''
                                  return
                                }
                              handleUpdateItemQtyPrice(i, v, null, null)
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                              }}
                              disabled={isUpdating || wallInsulationInactive}
                              placeholder="Вручную"
                              className="w-full max-w-[7rem] rounded border border-slate-300 px-2 py-1 text-sm tabular-nums focus:ring-1 focus:ring-primary-500 focus:border-primary-500 disabled:bg-slate-100 disabled:text-slate-400"
                            />
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-1.5 text-sm text-slate-600 tabular-nums">
                        <span
                          className={kpApproved ? 'text-slate-600' : 'font-medium text-slate-800'}
                          title={
                            wallInsulationInactive
                              ? 'Включите «Двойной брус» для расчёта'
                              : isLinkedAssemblyItem(i)
                                ? 'Как у 3-й позиции шаблона (не редактируется)'
                                : 'Итоговое количество (не редактируется в таблице)'
                          }
                        >
                          {formatQtyAuto(i.quantity)}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-sm text-slate-600">{i.unit ?? '—'}</td>
                      <td className="px-3 py-1.5" style={{ width: 100, minWidth: 100 }}>
                        {kpApproved ? (
                          <span className="text-sm text-slate-600 tabular-nums">
                            {i.price != null ? Number(i.price).toLocaleString('ru-RU') : '—'}
                          </span>
                        ) : (
                          <input
                            key={`price-${i.id}-${i.price ?? 'x'}-${i.nomenclature_item_id ?? 'n'}`}
                            type="text"
                            inputMode="decimal"
                            defaultValue={i.price != null ? Number(i.price).toLocaleString('ru-RU') : ''}
                            onBlur={(e) => {
                              const raw = e.target.value.trim().replace(/\s+/g, '').replace(',', '.')
                              const v = parseFloat(raw)
                              if (!Number.isNaN(v) && v >= 0) {
                                handleUpdateItemQtyPrice(i, null, v, null)
                                ;(e.target as HTMLInputElement).value = Number(v).toLocaleString('ru-RU')
                              } else {
                                ;(e.target as HTMLInputElement).value =
                                  i.price != null ? Number(i.price).toLocaleString('ru-RU') : ''
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                            }}
                            disabled={isUpdating || wallInsulationInactive}
                            className="w-full max-w-[100px] rounded border border-slate-300 px-2 py-1 text-sm tabular-nums focus:ring-1 focus:ring-primary-500 focus:border-primary-500 disabled:bg-slate-100 disabled:text-slate-400"
                          />
                        )}
                      </td>
                      <td className="px-3 py-1.5" style={{ width: 90, minWidth: 90 }}>
                        {kpApproved ? (
                          <span className="text-sm text-slate-600 tabular-nums">
                            {i.discount_percent != null ? Number(i.discount_percent).toLocaleString('ru-RU') : 0}
                          </span>
                        ) : (
                          <input
                            key={`discount-${i.id}-${i.discount_percent ?? 'x'}`}
                            type="number"
                            step="1"
                            min={0}
                            max={100}
                            defaultValue={i.discount_percent ?? 0}
                            onBlur={(e) => {
                              const v = parseFloat(e.target.value)
                              if (!Number.isNaN(v) && v >= 0 && v <= 100) handleUpdateItemQtyPrice(i, null, null, v)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                            }}
                            disabled={isUpdating || wallInsulationInactive}
                            className="w-full max-w-[6rem] rounded border border-slate-300 px-2 py-1 text-sm tabular-nums focus:ring-1 focus:ring-primary-500 focus:border-primary-500 disabled:bg-slate-100 disabled:text-slate-400"
                          />
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-sm text-slate-600 tabular-nums">
                        {i.total != null ? Number(i.total).toLocaleString('ru-RU') : '—'}
                      </td>
                      {!kpApproved && (
                        <td className="px-3 py-1.5">
                          <EditIconButton onClick={() => handleStartEditItem(i)} />
                          <DeleteIconButton onClick={() => handleDeleteItem(i)} />
                        </td>
                      )}
                    </tr>
                    {materialsExpanded && (
                      <tr className="bg-slate-50/90">
                        <td colSpan={colCount} className="px-4 py-3 text-sm border-t border-slate-100">
                          <div className="font-medium text-slate-700 mb-2">Материал (из настроек шаблона)</div>
                          {matStatus === 'error' ? (
                            <p className="text-red-600 m-0">Не удалось загрузить список материалов.</p>
                          ) : matStatus === 'loading' || mats === undefined ? (
                            <p className="text-slate-500 m-0">Загрузка…</p>
                          ) : mats.length === 0 ? (
                            <p className="text-slate-600 m-0">
                              Для этого шаблона не заданы допустимые материалы.{' '}
                              <Link to="/settings/required-item-materials" className="text-primary-500 hover:underline">
                                Настроить в справочнике
                              </Link>
                            </p>
                          ) : (
                            <ul className="list-none m-0 p-0 space-y-2">
                              {mats.map((m) => (
                                <li key={m.id} className="flex items-start gap-2">
                                  <input
                                    type="radio"
                                    className="mt-1"
                                    id={`spec-mat-${i.id}-${m.id}`}
                                    name={`spec-mat-${i.id}`}
                                    checked={i.nomenclature_item_id === m.nomenclature_id}
                                    disabled={kpApproved || isUpdating}
                                    onChange={() => handleSelectRequiredMaterial(i, m.nomenclature_id)}
                                  />
                                  <label htmlFor={`spec-mat-${i.id}-${m.id}`} className="cursor-pointer text-slate-800">
                                    {materialNomLabel(m.nomenclature_id)}
                                  </label>
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                    )
                  })}
                </React.Fragment>
              )
            })
          })()}
        </tbody>
      </table>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: chromeCollapsed ? 'calc(100vh - 1.5rem)' : 'calc(100vh - 12rem + 100px)',
        minHeight: 0,
      }}
    >
      <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => {
            const customerId = project?.customer_id
            navigate(customerId != null ? `/customers?customer_id=${customerId}` : '/customers')
          }}
          className="btn btn-default"
        >
          ← К клиентам
        </button>
        <h2 style={{ margin: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '8px 16px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            Спецификации{project ? ' — ' : ''}
            {project && editingProjectName ? (
              <input
                type="text"
                value={projectNameDraft}
                onChange={(e) => setProjectNameDraft(e.target.value)}
                onBlur={saveProjectName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                  if (e.key === 'Escape') {
                    setEditingProjectName(false)
                    setProjectNameDraft('')
                  }
                }}
                disabled={savingProjectName}
                className="form-control"
                style={{ width: 'auto', minWidth: 160, maxWidth: 360, fontSize: 'inherit', fontWeight: 'inherit' }}
                autoFocus
              />
            ) : project ? (
              <>
                <span>{project.name}</span>
                <EditIconButton title="Редактировать название проекта" onClick={startEditProjectName} />
              </>
            ) : null}
          </span>
          {project != null && (
            <span style={{ fontWeight: 400, fontSize: 15, color: '#73879C' }}>
              Бюджет: {formatMoneyRuNullable(customerBudget)}
            </span>
          )}
        </h2>
        {selectedSpecId != null && (
          <div ref={docTypeMenuRef} style={{ position: 'relative', display: 'inline-block', marginLeft: 'auto' }}>
            <button
              type="button"
              onClick={() => setDocTypeMenuOpen((v) => !v)}
              className="btn btn-success"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              Документы
              <span style={{ fontSize: 10, opacity: 0.9 }}>▼</span>
            </button>
            {docTypeMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: 4,
                  minWidth: 200,
                  padding: '4px 0',
                  background: '#fff',
                  border: '1px solid #E6E9ED',
                  borderRadius: 3,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  zIndex: 10,
                }}
              >
                {positionsDocTypeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={async () => {
                      setDocTypeMenuOpen(false)
                      if (opt.value === 'contract-form') {
                        openContractDataTab('contract')
                        return
                      }
                      if (opt.value === 'kp-standart-client' && selectedSpecId != null) {
                        setKpClientDownloadLabel('Формирование КП Стандарт (таблица)…')
                        setDownloadingKpStandartClient(true)
                        await yieldToPaint()
                        try {
                          await api.specifications.downloadKpStandartClientPdf(selectedSpecId)
                        } catch (e) {
                          alert(e instanceof Error ? e.message : String(e))
                        } finally {
                          setDownloadingKpStandartClient(false)
                        }
                        return
                      }
                      if (
                        (opt.value === 'kp-overlay-client-2' || opt.value === 'kp-overlay-client-v2') &&
                        selectedSpecId != null
                      ) {
                        const agreedCount = specs.filter((s) => s.kp_approved === true).length
                        const isV2 = opt.value === 'kp-overlay-client-v2'
                        setKpClientDownloadLabel(
                          agreedCount >= 2
                            ? 'Формирование КП сводное…'
                            : isV2
                              ? 'Формирование КП для клиента 2…'
                              : 'Формирование КП для клиента…',
                        )
                        if (isV2) {
                          setDownloadingKpClientV2(true)
                        } else {
                          setDownloadingKpClient2(true)
                        }
                        await yieldToPaint()
                        try {
                          if (isV2) {
                            await api.specifications.downloadKpOverlayClientV2Pdf(selectedSpecId)
                          } else {
                            await api.specifications.downloadKpOverlayClient2Pdf(selectedSpecId)
                          }
                        } catch (e) {
                          alert(e instanceof Error ? e.message : String(e))
                        } finally {
                          if (isV2) {
                            setDownloadingKpClientV2(false)
                          } else {
                            setDownloadingKpClient2(false)
                          }
                        }
                        return
                      }
                    }}
                    className="btn btn-default"
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      border: 'none',
                      borderRadius: 0,
                    }}
                    disabled={
                      (opt.value === 'kp-overlay-client-2' && downloadingKpClient2) ||
                      (opt.value === 'kp-overlay-client-v2' && downloadingKpClientV2) ||
                      (opt.value === 'kp-standart-client' && downloadingKpStandartClient)
                    }
                  >
                    {((opt.value === 'kp-overlay-client-2' && downloadingKpClient2) ||
                      (opt.value === 'kp-overlay-client-v2' && downloadingKpClientV2) ||
                      (opt.value === 'kp-standart-client' && downloadingKpStandartClient))
                      ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          <span className="kp-download-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} aria-hidden />
                          Формирование…
                        </span>
                      )
                      : opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="row" style={{ flex: 1, minHeight: 0, display: 'flex', flexWrap: 'nowrap', marginLeft: 0, marginRight: 0 }}>
        {!chromeCollapsed && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            paddingRight: 8,
            flex: '0 1 calc(25% - 150px)',
            minWidth: 180,
          }}
        >
          <div className="x_panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="x_title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <ChromeBurgerButton expanded onClick={toggleChromeCollapsed} />
                <h2 style={{ margin: 0 }}>Спецификации ({specs.length})</h2>
              </div>
              <div style={{ flexShrink: 0 }}>
                <button
                  type="button"
                  className="btn btn-success"
                  disabled={creatingSpec || !project?.customer_id}
                  onClick={handleCreateSpecificationFromDefaultTemplate}
                  title="Новая спецификация и заполнение из шаблона спецификации дома №1"
                >
                  {creatingSpec ? '…' : 'Создать'}
                </button>
              </div>
            </div>
            <div className="x_content" style={{ flex: 1, overflow: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 0 }}>
              {specsLoading ? (
                <p style={{ color: '#73879C', padding: 12 }}>Загрузка…</p>
              ) : specs.length === 0 ? (
                <p style={{ color: '#73879C', padding: 12 }}>Нет спецификаций по проекту</p>
              ) : (
                specs.map((s) => {
                  const isActive = selectedSpecId === s.id
                  return (
                    <div
                      key={s.id}
                      className={`list-item nav-card ${isActive ? 'active' : ''}`}
                      style={{
                        width: '100%',
                        borderLeftColor: s.kp_approved ? '#1ABB9C' : '#5A738E',
                        flexDirection: 'row',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: 8,
                        cursor: 'pointer',
                      }}
                      onClick={async () => {
                        await flushContractPanelSaveRef.current()
                        setSelectedSpecId(s.id)
                        setContractTab(null)
                        setActiveContractDocumentId(null)
                        setSpecTab('positions')
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <span style={{ fontWeight: 600, wordBreak: 'break-word' }}>
                          {(s.comment ?? '').trim() || '—'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <DuplicateIconButton
                          onClick={(e) => handleDuplicateSpec(e, s.id)}
                          disabled={duplicatingSpecId === s.id}
                          title={duplicatingSpecId === s.id ? 'Дублирование…' : 'Дублировать'}
                        />
                        <DeleteIconButton
                          onClick={(e) => handleDeleteSpec(e, s.id, `Спецификация № ${s.number ?? s.id}`)}
                          title="Удалить"
                        />
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
        )}

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            minWidth: 0,
            paddingLeft: chromeCollapsed ? 0 : 8,
            flex: chromeCollapsed ? '1 1 100%' : '1 1 calc(75% + 150px)',
          }}
        >
          <div className="x_panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="x_title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {contractTab === 'data' ? (
                  <h2 style={{ margin: 0 }}>
                    {activeContractDocumentId != null
                      ? contractDocumentLabel(activeContractDocumentId)
                      : 'Данные для договора'}
                  </h2>
                ) : editingItemId != null ? (
                  <h2 style={{ margin: 0 }}>Редактировать позицию</h2>
                ) : showTemplatePicker ? (
                  <h2 style={{ margin: 0 }}>Выберите шаблон спецификации дома</h2>
                ) : (
                  <>
                    <div className="btn-group" style={{ display: 'inline-flex' }}>
                      <button
                        type="button"
                        className={`btn ${specTab === 'positions' ? 'btn-primary' : 'btn-default'}`}
                        style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
                        onClick={() => setSpecTab('positions')}
                      >
                        Позиции{selectedSpecId != null ? ` (#${selectedSpecId})` : ''}
                      </button>
                      <button
                        type="button"
                        className={`btn ${specTab === 'photos' ? 'btn-primary' : 'btn-default'}`}
                        style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, marginLeft: -1 }}
                        onClick={() => setSpecTab('photos')}
                      >
                        Фотографии{specPhotos.length > 0 ? ` (${specPhotos.length})` : ''}
                      </button>
                    </div>
                  </>
                )}
                {contractTab === 'data' &&
                  (activeContractDocumentId === 'supply_contract' || activeContractDocumentId === 'mount_contract') && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, color: '#73879C' }}>Организация:</span>
                    <select
                      value={
                        activeContractDocumentId === 'supply_contract'
                          ? (project?.organization_id_supply ?? defaultOrganization?.id ?? '')
                          : (project?.organization_id_mount ?? defaultOrganization?.id ?? '')
                      }
                      onChange={(e) => {
                        const val = e.target.value ? parseInt(e.target.value, 10) : null
                        if (!Number.isFinite(id)) return
                        const payload = activeContractDocumentId === 'supply_contract'
                          ? { organization_id_supply: val }
                          : { organization_id_mount: val }
                        api.projects.update(id, payload).then(setProject)
                      }}
                      className="form-control"
                      style={{ width: 'auto', minWidth: 220, display: 'inline-block' }}
                    >
                      {organizations.map((org) => (
                        <option key={org.id} value={org.id}>
                          {org.name}
                          {org.is_default ? ' (по умолчанию)' : ''}
                        </option>
                      ))}
                      {organizations.length === 0 && (
                        <option value="">—</option>
                      )}
                    </select>
                  </div>
                )}
                {selectedSpecId != null &&
                  !showTemplatePicker &&
                  editingItemId == null &&
                  contractTab !== 'data' &&
                  specTab === 'positions' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <label
                      htmlFor="kp-internal-comment"
                      style={{ fontSize: 13, color: '#73879C', whiteSpace: 'nowrap', margin: 0 }}
                      title="Используется в договоре"
                    >
                      Название в договоре
                    </label>
                    <input
                      id="kp-internal-comment"
                      type="text"
                      value={kpInternalComment}
                      onChange={(e) => setKpInternalComment(e.target.value)}
                      onBlur={saveKpInternalComment}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                      }}
                      disabled={savingKpComment}
                      placeholder="Название в договоре"
                      className="form-control"
                      style={{ width: 220, maxWidth: 'min(320px, 40vw)' }}
                    />
                    <label
                      htmlFor="spec-comment"
                      style={{ fontSize: 13, color: '#73879C', whiteSpace: 'nowrap', margin: 0 }}
                      title="Отображается в списке спецификаций слева"
                    >
                      Комментарий
                    </label>
                    <input
                      id="spec-comment"
                      type="text"
                      value={specComment}
                      onChange={(e) => setSpecComment(e.target.value)}
                      onBlur={saveSpecComment}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                      }}
                      disabled={savingSpecComment}
                      placeholder="Комментарий"
                      className="form-control"
                      style={{ width: 220, maxWidth: 'min(320px, 40vw)' }}
                    />
                    {!kpApproved && (
                      <button
                        type="button"
                        onClick={handleApproveKp}
                        disabled={updatingKp}
                        className="btn btn-success"
                      >
                        {updatingKp ? '…' : 'Согласовать КП'}
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {editingItemId != null && (
                  <button type="button" onClick={() => setEditingItemId(null)} className="btn btn-default">
                    Отмена
                  </button>
                )}
                {selectedSpecId != null && !showTemplatePicker && editingItemId == null && contractTab !== 'data' && kpApproved && specTab === 'positions' && (
                  <button
                    type="button"
                    onClick={handleUnapproveKp}
                    disabled={updatingKp}
                    className="btn btn-default"
                  >
                    {updatingKp ? '…' : 'Отменить согласование'}
                  </button>
                )}
                {selectedSpecId != null && !showTemplatePicker && editingItemId == null && contractTab !== 'data' && !kpApproved && specTab === 'positions' && (
                  <button
                    type="button"
                    onClick={() => setShowAddItemModal(true)}
                    className="btn btn-success"
                  >
                    Добавить позицию
                  </button>
                )}
                {showTemplatePicker && (
                  <button type="button" onClick={() => setShowTemplatePicker(false)} className="btn btn-default">
                    Отмена
                  </button>
                )}
              </div>
            </div>
            <div className="x_content" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
              {selectedSpecId != null && !showTemplatePicker && editingItemId == null && contractTab !== 'data' && specTab === 'positions' && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    width: '100%',
                    padding: '10px 16px',
                    borderBottom: '1px solid #E6E9ED',
                    background: '#f9fafb',
                  }}
                >
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#73879C', marginBottom: 2 }}>Длина дома, м</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="form-control"
                      style={{ width: 100 }}
                      value={specDimsForm.length_m}
                      onChange={(e) => setSpecDimsForm((f) => ({ ...f, length_m: e.target.value }))}
                      onBlur={handleSpecDimsFieldBlur}
                      disabled={kpApproved}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#73879C', marginBottom: 2 }}>Ширина дома, м</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="form-control"
                      style={{ width: 100 }}
                      value={specDimsForm.width_m}
                      onChange={(e) => setSpecDimsForm((f) => ({ ...f, width_m: e.target.value }))}
                      onBlur={handleSpecDimsFieldBlur}
                      disabled={kpApproved}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#73879C', marginBottom: 2 }}>Этажность</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="form-control"
                      style={{ width: 90 }}
                      value={specDimsForm.floors}
                      onChange={(e) => setSpecDimsForm((f) => ({ ...f, floors: e.target.value }))}
                      onBlur={handleSpecDimsFieldBlur}
                      disabled={kpApproved}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#73879C', marginBottom: 2 }}>Комнат</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="form-control"
                      style={{ width: 90 }}
                      value={specDimsForm.room_count}
                      onChange={(e) => setSpecDimsForm((f) => ({ ...f, room_count: e.target.value }))}
                      onBlur={handleSpecDimsFieldBlur}
                      disabled={kpApproved}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#73879C', marginBottom: 2 }}>
                      Высота k, м
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="form-control"
                      style={{ width: 100 }}
                      value={specDimsForm.wall_height_m}
                      onChange={(e) => setSpecDimsForm((f) => ({ ...f, wall_height_m: e.target.value }))}
                      onBlur={handleSpecDimsFieldBlur}
                      disabled={kpApproved}
                      title="k для Sds (Pd×k×Tb×lot) и Sst (Lst×k×Cr×Tb); по умолчанию 2,8 м"
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 6 }}>
                    <label
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: 13,
                        color: '#2A3F54',
                        cursor: kpApproved ? 'default' : 'pointer',
                        margin: 0,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={specDimsForm.double_timber}
                        onChange={(e) => {
                          const checked = e.target.checked
                          setSpecDimsForm((f) => ({ ...f, double_timber: checked }))
                          if (selectedSpecId == null || selectedSpec == null || kpApproved) return
                          if (checked === Boolean(selectedSpec.double_timber)) return
                          api.specifications
                            .update(selectedSpecId, { double_timber: checked })
                            .then(async () => {
                              await reloadCurrentSpecItems()
                              if (Number.isFinite(id)) {
                                const all = await api.specifications.list({ project_id: id })
                                setSpecs(all)
                              }
                            })
                            .catch((err) => alert(err instanceof Error ? err.message : String(err)))
                        }}
                        disabled={kpApproved}
                      />
                      Двойной брус
                    </label>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#73879C', marginBottom: 2 }}>Длина террасы, м</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="form-control"
                      style={{ width: 100 }}
                      value={specDimsForm.terrace_length_m}
                      onChange={(e) => setSpecDimsForm((f) => ({ ...f, terrace_length_m: e.target.value }))}
                      onBlur={handleSpecDimsFieldBlur}
                      disabled={kpApproved}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#73879C', marginBottom: 2 }}>Длина балкона, м</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="form-control"
                      style={{ width: 100 }}
                      value={specDimsForm.balcony_length_m}
                      onChange={(e) => setSpecDimsForm((f) => ({ ...f, balcony_length_m: e.target.value }))}
                      onBlur={handleSpecDimsFieldBlur}
                      disabled={kpApproved}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 6 }}>
                    <label
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: 13,
                        color: '#2A3F54',
                        cursor: kpApproved ? 'default' : 'pointer',
                        margin: 0,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={specDimsForm.terrace_second_floor}
                        onChange={(e) => {
                          const checked = e.target.checked
                          setSpecDimsForm((f) => ({ ...f, terrace_second_floor: checked }))
                          if (selectedSpecId == null || selectedSpec == null || kpApproved) return
                          if (checked === Boolean(selectedSpec.terrace_second_floor)) return
                          api.specifications
                            .update(selectedSpecId, { terrace_second_floor: checked })
                            .then(async () => {
                              await reloadCurrentSpecItems()
                              if (Number.isFinite(id)) {
                                const all = await api.specifications.list({ project_id: id })
                                setSpecs(all)
                              }
                            })
                            .catch((err) => alert(err instanceof Error ? err.message : String(err)))
                        }}
                        disabled={kpApproved}
                      />
                      Терраса на втором этаже
                    </label>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#73879C', marginBottom: 2 }}>Сумма</div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: '#2A3F54', whiteSpace: 'nowrap' }}>
                      {selectedSpec?.total_amount != null
                        ? `${Number(selectedSpec.total_amount).toLocaleString('ru-RU')} ₽`
                        : '—'}
                    </div>
                  </div>
                  {project != null && (
                    <div>
                      <div style={{ fontSize: 12, color: '#73879C', marginBottom: 2 }}>Бюджет</div>
                      <div style={{ fontSize: 16, fontWeight: 600, color: '#2A3F54', whiteSpace: 'nowrap' }}>
                        {formatMoneyRuNullable(customerBudget)}
                      </div>
                    </div>
                  )}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-end',
                      flexWrap: 'wrap',
                      gap: 16,
                      paddingBottom: 6,
                    }}
                  >
                    <div>
                      <label style={{ display: 'block', fontSize: 12, color: '#73879C', marginBottom: 2 }}>Тип</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 2 }}>
                        <label
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: 13,
                            color: '#2A3F54',
                            cursor: kpApproved ? 'default' : 'pointer',
                            margin: 0,
                          }}
                        >
                          <input
                            type="radio"
                            name="building_type"
                            checked={specDimsForm.building_type === 'house'}
                            onChange={() => {
                              setSpecDimsForm((f) => ({ ...f, building_type: 'house' }))
                              if (selectedSpecId == null || selectedSpec == null || kpApproved) return
                              if ((selectedSpec.building_type ?? 'house') === 'house') return
                              api.specifications
                                .update(selectedSpecId, { building_type: 'house' })
                                .then(async () => {
                                  if (Number.isFinite(id)) {
                                    const all = await api.specifications.list({ project_id: id })
                                    setSpecs(all)
                                  }
                                })
                                .catch((err) => alert(err instanceof Error ? err.message : String(err)))
                            }}
                            disabled={kpApproved}
                          />
                          Дом
                        </label>
                        <label
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: 13,
                            color: '#2A3F54',
                            cursor: kpApproved ? 'default' : 'pointer',
                            margin: 0,
                          }}
                        >
                          <input
                            type="radio"
                            name="building_type"
                            checked={specDimsForm.building_type === 'banya'}
                            onChange={() => {
                              setSpecDimsForm((f) => ({ ...f, building_type: 'banya' }))
                              if (selectedSpecId == null || selectedSpec == null || kpApproved) return
                              if (selectedSpec.building_type === 'banya') return
                              api.specifications
                                .update(selectedSpecId, { building_type: 'banya' })
                                .then(async () => {
                                  if (Number.isFinite(id)) {
                                    const all = await api.specifications.list({ project_id: id })
                                    setSpecs(all)
                                  }
                                })
                                .catch((err) => alert(err instanceof Error ? err.message : String(err)))
                            }}
                            disabled={kpApproved}
                          />
                          Баня
                        </label>
                      </div>
                    </div>
                  </div>
                  <details
                    style={{
                      flexBasis: '100%',
                      width: '100%',
                      margin: 0,
                      padding: '4px 0 0',
                      borderTop: '1px solid #E6E9ED',
                    }}
                  >
                    <summary
                      style={{
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 500,
                        color: '#2A3F54',
                        userSelect: 'none',
                      }}
                    >
                      Расчётные показатели
                    </summary>
                    <div
                      style={{
                        paddingTop: 10,
                        paddingBottom: 4,
                        overflowX: 'auto',
                      }}
                    >
                      <table className="table table-striped" style={{ marginBottom: 0, maxWidth: 520 }}>
                        <thead>
                          <tr>
                            <th>Показатель</th>
                            <th style={{ width: 120, textAlign: 'right' }}>Значение</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td style={{ color: '#73879C' }}>Периметр дома, м</td>
                            <td style={{ textAlign: 'right', fontWeight: 600, color: '#2A3F54' }}>{formatCalcDim(housePerimeterM)}</td>
                          </tr>
                          <tr>
                            <td style={{ color: '#73879C' }}>Площадь дома, м²</td>
                            <td style={{ textAlign: 'right', fontWeight: 600, color: '#2A3F54' }}>{formatCalcDim(houseAreaM2)}</td>
                          </tr>
                          <tr>
                            <td style={{ color: '#73879C' }}>Площадь террасы, м²</td>
                            <td style={{ textAlign: 'right', fontWeight: 600, color: '#2A3F54' }}>{formatCalcDim(terraceAreaM2)}</td>
                          </tr>
                          <tr>
                            <td style={{ color: '#73879C' }}>Длина стен комнат, м</td>
                            <td style={{ textAlign: 'right', fontWeight: 600, color: '#2A3F54' }}>{formatCalcDim(roomWallsLengthM)}</td>
                          </tr>
                          <tr>
                            <td style={{ color: '#73879C' }}>Площадь стен комнат, м²</td>
                            <td style={{ textAlign: 'right', fontWeight: 600, color: '#2A3F54' }}>{formatCalcDim(roomWallsAreaM2)}</td>
                          </tr>
                          <tr>
                            <td style={{ color: '#73879C' }}>Длина домокомплекта, м</td>
                            <td style={{ textAlign: 'right', fontWeight: 600, color: '#2A3F54' }}>{formatCalcDim(kitLengthM)}</td>
                          </tr>
                          <tr>
                            <td style={{ color: '#73879C' }}>Ширина домокомплекта, м</td>
                            <td style={{ textAlign: 'right', fontWeight: 600, color: '#2A3F54' }}>{formatCalcDim(kitWidthM)}</td>
                          </tr>
                          <tr>
                            <td style={{ color: '#73879C' }}>Периметр домокомплекта, м</td>
                            <td style={{ textAlign: 'right', fontWeight: 600, color: '#2A3F54' }}>{formatCalcDim(kitPerimeterM)}</td>
                          </tr>
                          <tr>
                            <td style={{ color: '#73879C' }}>Площадь домокомплекта (по полу), м²</td>
                            <td style={{ textAlign: 'right', fontWeight: 600, color: '#2A3F54' }}>{formatCalcDim(kitAreaM2)}</td>
                          </tr>
                          <tr>
                            <td style={{ color: '#73879C' }}>Площадь домокомплекта (по стенам), м²</td>
                            <td style={{ textAlign: 'right', fontWeight: 600, color: '#2A3F54' }}>{formatCalcDim(kitWallAreaM2)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </details>
                </div>
              )}
              {contractTab === 'data' && Number.isFinite(id) ? (
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'auto', padding: 16 }}>
                      {contractDataLoading && activeContractDocumentId == null && contractDataModalTab === 'contract' ? (
                        <p style={{ color: '#73879C' }}>Загрузка…</p>
                      ) : (
                        <>
                          <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid #eee', paddingBottom: 8, flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className={`btn ${contractDataModalTab === 'contract' ? 'btn-primary' : 'btn-default'}`}
                              onClick={() => {
                                setContractDataModalTab('contract')
                                setActiveContractDocumentId(null)
                                if (contractData == null) {
                                  loadContractDataPanel({
                                    preserveCustomerForm:
                                      Object.keys(contractModalCustomerFormRef.current).length > 0,
                                  })
                                }
                              }}
                            >
                              Данные договора
                            </button>
                            <button
                              type="button"
                              className={`btn ${contractDataModalTab === 'documents' ? 'btn-primary' : 'btn-default'}`}
                              onClick={() => {
                                setContractDataModalTab('documents')
                                setActiveContractDocumentId(null)
                              }}
                            >
                              Документы
                            </button>
                          </div>
                          {contractDataModalTab === 'documents' ? (
                            activeContractDocumentId == null ? (
                            <div style={{ overflowX: 'auto' }}>
                              <table className="table table-striped" style={{ marginBottom: 0 }}>
                                <thead>
                                  <tr>
                                    <th>Документ</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {CONTRACT_DOCUMENTS.map((doc) => (
                                    <tr
                                      key={doc.id}
                                      role="button"
                                      tabIndex={0}
                                      style={{ cursor: 'pointer' }}
                                      className="contract-doc-row"
                                      onClick={() => openDocumentEditor(doc.id)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                          e.preventDefault()
                                          openDocumentEditor(doc.id)
                                        }
                                      }}
                                    >
                                      <td style={{ fontSize: 14, color: '#2A3F54', padding: '14px 12px' }}>
                                        {doc.label}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              <style>{`
                                .contract-doc-row:hover td { background-color: #f0f4f8 !important; }
                                .contract-doc-row:focus td { background-color: #e8eef4 !important; outline: none; }
                              `}</style>
                            </div>
                            ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: 12 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <button
                                  type="button"
                                  className="btn btn-default btn-sm"
                                  onClick={() => {
                                    setActiveContractDocumentId(null)
                                  }}
                                >
                                  ← К списку документов
                                </button>
                                {(activeContractDocumentId === 'supply_contract' ||
                                  activeContractDocumentId === 'mount_contract') && (
                                  <>
                                    <div className="btn-group" style={{ display: 'inline-flex' }}>
                                      <button
                                        type="button"
                                        className={`btn ${contractDocumentEditorTab === 'result' ? 'btn-primary' : 'btn-default'}`}
                                        style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
                                        onClick={() => refreshContractDocumentResult()}
                                      >
                                        Результат
                                      </button>
                                      <button
                                        type="button"
                                        className={`btn ${contractDocumentEditorTab === 'template' ? 'btn-primary' : 'btn-default'}`}
                                        style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, marginLeft: -1 }}
                                        onClick={async () => {
                                          if (!Number.isFinite(id) || !activeContractDocumentId) return
                                          const { html } = await loadProjectDocumentHtml(activeContractDocumentId)
                                          setTemplateContent(decodeHtmlEntities(html))
                                          setContractDocumentEditorTab('template')
                                        }}
                                      >
                                        Шаблон
                                      </button>
                                    </div>
                                    {activeContractDocumentId === 'supply_contract' ? (
                                      <div
                                        ref={fillTemplateMenuRef}
                                        style={{ position: 'relative', display: 'inline-block' }}
                                      >
                                        <button
                                          type="button"
                                          className="btn btn-success"
                                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                                          onClick={() => setFillTemplateMenuOpen((v) => !v)}
                                        >
                                          Заполнить из шаблона
                                          <span style={{ fontSize: 10, opacity: 0.9 }}>▼</span>
                                        </button>
                                        {fillTemplateMenuOpen && (
                                          <div
                                            style={{
                                              position: 'absolute',
                                              top: '100%',
                                              left: 0,
                                              marginTop: 4,
                                              minWidth: 220,
                                              padding: '4px 0',
                                              background: '#fff',
                                              border: '1px solid #E6E9ED',
                                              borderRadius: 3,
                                              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                              zIndex: 20,
                                            }}
                                          >
                                            {(
                                              Object.entries(SUPPLY_CONTRACT_TEMPLATES) as [
                                                'individual' | 'legal',
                                                (typeof SUPPLY_CONTRACT_TEMPLATES)['individual'],
                                              ][]
                                            ).map(([party, cfg]) => (
                                              <button
                                                key={party}
                                                type="button"
                                                className="btn btn-default"
                                                style={{
                                                  width: '100%',
                                                  textAlign: 'left',
                                                  border: 'none',
                                                  borderRadius: 0,
                                                  padding: '8px 14px',
                                                  fontSize: 13,
                                                }}
                                                onClick={() => fillFromSupplyContractTemplate(party)}
                                              >
                                                {cfg.label}
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        className="btn btn-success"
                                        onClick={() => fillActiveDocumentFromTemplate()}
                                      >
                                        Заполнить из шаблона
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      className="btn btn-default"
                                      style={{ padding: '6px 10px' }}
                                      title="Печать PDF"
                                      disabled={printingDocumentId != null || contractPdfLoading}
                                      onClick={() => printProjectDocument(activeContractDocumentId)}
                                    >
                                      {printingDocumentId === activeContractDocumentId ? '…' : <PrinterIcon />}
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-default btn-sm"
                                      disabled={downloadingContractPdf || contractPdfLoading}
                                      onClick={() => downloadContractPdf(activeContractDocumentId)}
                                    >
                                      {downloadingContractPdf ? '…' : 'Скачать PDF'}
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-success"
                                      disabled={savingResult}
                                      onClick={() => {
                                        if (!Number.isFinite(id) || !activeContractDocumentId) return
                                        setSavingResult(true)
                                        api.projects
                                          .updateContractDocument(id, activeContractDocumentId, {
                                            html_body: templateContent || null,
                                          })
                                          .then((doc) => {
                                            setContractDocumentsHtml((prev) => ({
                                              ...prev,
                                              [activeContractDocumentId]: doc.html_body ?? '',
                                            }))
                                          })
                                          .then(() => {
                                            if (contractDocumentEditorTab === 'result') {
                                              return loadContractPdfPreview()
                                            }
                                          })
                                          .catch((e) => alert(e instanceof Error ? e.message : String(e)))
                                          .finally(() => setSavingResult(false))
                                      }}
                                    >
                                      {savingResult ? '…' : 'Сохранить шаблон'}
                                    </button>
                                  </>
                                )}
                                {activeContractDocumentId !== 'supply_contract' &&
                                  activeContractDocumentId !== 'mount_contract' && (
                                  <>
                                    <button
                                      type="button"
                                      className="btn btn-success"
                                      onClick={() => fillActiveDocumentFromTemplate()}
                                    >
                                      Заполнить из шаблона
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-default"
                                      style={{ padding: '6px 10px' }}
                                      title="Печать PDF"
                                      disabled={printingDocumentId != null || contractPdfLoading}
                                      onClick={() => printProjectDocument(activeContractDocumentId)}
                                    >
                                      {printingDocumentId === activeContractDocumentId ? '…' : <PrinterIcon />}
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-default btn-sm"
                                      disabled={downloadingContractPdf || contractPdfLoading}
                                      onClick={() => downloadContractPdf(activeContractDocumentId)}
                                    >
                                      {downloadingContractPdf ? '…' : 'Скачать PDF'}
                                    </button>
                                  </>
                                )}
                              </div>
                              {activeContractDocumentId === 'supply_contract' ||
                              activeContractDocumentId === 'mount_contract' ? (
                                contractDocumentEditorTab === 'result' ? (
                                  renderContractPdfPreview()
                                ) : (
                                  <div style={{ flex: 1, minHeight: 430, display: 'flex', flexDirection: 'column' }}>
                                    <HtmlCodeEditor
                                      value={templateContent}
                                      onChange={setTemplateContent}
                                      height="100%"
                                    />
                                  </div>
                                )
                              ) : (
                                renderContractPdfPreview()
                              )}
                            </div>
                            )
                          ) : (
                            <form
                              onSubmit={(e) => {
                                e.preventDefault()
                                if (!Number.isFinite(id)) return
                                setContractDataSaving(true)
                                flushContractPanelSave()
                                  .catch((err) => alert(err instanceof Error ? err.message : String(err)))
                                  .finally(() => setContractDataSaving(false))
                              }}
                              style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
                            >
                              <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: '1 1 320px', minWidth: 280, maxWidth: 420 }}>
                              <div
                                style={{
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  alignItems: 'center',
                                  gap: 16,
                                  paddingBottom: 12,
                                  borderBottom: '1px solid #eee',
                                }}
                              >
                                <span style={{ fontSize: 13, fontWeight: 600, color: '#2A3F54' }}>Покупатель:</span>
                                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, margin: 0, fontSize: 13, cursor: 'pointer' }}>
                                  <input
                                    type="radio"
                                    name="contract-buyer-party-type"
                                    checked={(contractDataForm.buyer_party_type ?? contractData?.buyer_party_type ?? 'individual') === 'individual'}
                                    onChange={() => onBuyerPartyTypeChange('individual')}
                                  />
                                  Физ лицо
                                </label>
                                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, margin: 0, fontSize: 13, cursor: 'pointer' }}>
                                  <input
                                    type="radio"
                                    name="contract-buyer-party-type"
                                    checked={(contractDataForm.buyer_party_type ?? contractData?.buyer_party_type ?? 'individual') === 'legal'}
                                    onChange={() => onBuyerPartyTypeChange('legal')}
                                  />
                                  Юр лицо
                                </label>
                              </div>
                                <div>
                                  <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>Сумма договора поставки</label>
                                  <input
                                    type="text"
                                    className="form-control tabular-nums"
                                    readOnly
                                    value={contractData?.contract_supply_amount != null ? formatAmountInput(contractData.contract_supply_amount) : '—'}
                                    style={{ backgroundColor: '#f5f5f5' }}
                                  />
                                  {contractData?.contract_supply_amount_words ? (
                                    <p style={{ margin: '4px 0 0', fontSize: 11, lineHeight: 1.35, color: '#73879C', fontStyle: 'italic' }}>
                                      {contractData.contract_supply_amount_words}
                                    </p>
                                  ) : null}
                                  <span style={{ display: 'block', fontSize: 12, color: '#666', marginTop: 4 }}>Сумма согласованных КП</span>
                                </div>
                                <div>
                                  <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>Количество домокомплектов</label>
                                  <input type="text" className="form-control" readOnly value={contractData?.house_kits_count ?? '—'} style={{ backgroundColor: '#f5f5f5' }} />
                                  <span style={{ fontSize: 12, color: '#666' }}>Количество согласованных КП</span>
                                </div>
                                <div>
                                  <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>Дата договора</label>
                                  <RuDateInput
                                    value={contractDataForm.contract_date}
                                    onChange={(iso) => setContractDataForm((f) => ({ ...f, contract_date: iso }))}
                                  />
                                </div>
                                <div>
                                  <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>Город</label>
                                  <input type="text" className="form-control" value={contractDataForm.city ?? ''} onChange={(e) => setContractDataForm((f) => ({ ...f, city: e.target.value || undefined }))} placeholder="Место заключения договора" />
                                </div>
                                <div>
                                  <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>Предоплата (сумма)</label>
                                  <input
                                    key={`prepayment-${contractDataForm.prepayment_amount ?? 'e'}-${contractDataForm.balance_amount ?? 'b'}`}
                                    type="text"
                                    inputMode="decimal"
                                    className="form-control tabular-nums"
                                    defaultValue={formatAmountInput(contractDataForm.prepayment_amount)}
                                    onChange={(e) => {
                                      const newPrepayment = parseAmountInput(e.target.value)
                                      const total = contractData?.contract_supply_amount != null ? Number(contractData.contract_supply_amount) : undefined
                                      const newBalance = total != null
                                        ? (newPrepayment != null ? Math.round((total - newPrepayment) * 100) / 100 : total)
                                        : undefined
                                      setContractDataForm((f) => ({
                                        ...f,
                                        prepayment_amount: newPrepayment,
                                        balance_amount: newBalance ?? f.balance_amount,
                                      }))
                                    }}
                                    onBlur={(e) => {
                                      const newPrepayment = parseAmountInput(e.target.value)
                                      const total = contractData?.contract_supply_amount != null ? Number(contractData.contract_supply_amount) : undefined
                                      const balance = total != null && newPrepayment != null
                                        ? Math.round((total - newPrepayment) * 100) / 100
                                        : contractDataForm.balance_amount
                                      setContractDataForm((f) => ({
                                        ...f,
                                        prepayment_amount: newPrepayment,
                                        balance_amount: balance ?? f.balance_amount,
                                      }))
                                      e.target.value = formatAmountInput(newPrepayment)
                                      if (newPrepayment != null) {
                                        api.amountToWords(newPrepayment).then((r) => setContractDataForm((f) => ({ ...f, prepayment_words: r.words })))
                                      }
                                      if (balance != null) {
                                        api.amountToWords(balance).then((r) => setContractDataForm((f) => ({ ...f, balance_words: r.words })))
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                                    }}
                                  />
                                  {(contractDataForm.prepayment_words ?? contractData?.prepayment_words) ? (
                                    <p style={{ margin: '4px 0 0', fontSize: 11, lineHeight: 1.35, color: '#73879C', fontStyle: 'italic' }}>
                                      {contractDataForm.prepayment_words ?? contractData?.prepayment_words}
                                    </p>
                                  ) : null}
                                </div>
                                <div>
                                  <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>Остаток (сумма)</label>
                                  <input
                                    key={`balance-${contractDataForm.balance_amount ?? 'e'}`}
                                    type="text"
                                    inputMode="decimal"
                                    className="form-control tabular-nums"
                                    defaultValue={formatAmountInput(contractDataForm.balance_amount)}
                                    onBlur={(e) => {
                                      const v = parseAmountInput(e.target.value)
                                      setContractDataForm((f) => ({ ...f, balance_amount: v }))
                                      e.target.value = formatAmountInput(v)
                                      if (v != null) {
                                        api.amountToWords(v).then((r) => setContractDataForm((f) => ({ ...f, balance_words: r.words })))
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                                    }}
                                  />
                                  {(contractDataForm.balance_words ?? contractData?.balance_words) ? (
                                    <p style={{ margin: '4px 0 0', fontSize: 11, lineHeight: 1.35, color: '#73879C', fontStyle: 'italic' }}>
                                      {contractDataForm.balance_words ?? contractData?.balance_words}
                                    </p>
                                  ) : null}
                                  <span style={{ display: 'block', fontSize: 12, color: '#666', marginTop: 4 }}>Пересчитывается при изменении предоплаты</span>
                                </div>
                                <div>
                                  <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>Срок поставки (дата)</label>
                                  <RuDateInput
                                    value={contractDataForm.delivery_deadline}
                                    onChange={(iso) => setContractDataForm((f) => ({ ...f, delivery_deadline: iso }))}
                                  />
                                </div>
                              </div>
                              {project?.customer_id != null ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: '1 1 360px', minWidth: 300, maxWidth: 520 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#2A3F54', marginBottom: 4 }}>Данные клиента</div>
                              <div
                                style={{
                                  display: 'flex',
                                  gap: 8,
                                  marginBottom: 8,
                                  borderBottom: '1px solid #eee',
                                  paddingBottom: 8,
                                }}
                              >
                                <button
                                  type="button"
                                  className={`btn ${contractCustomerPartyTab === 'individual' ? 'btn-primary' : 'btn-default'}`}
                                  onClick={() => onBuyerPartyTypeChange('individual')}
                                >
                                  Физ лицо
                                </button>
                                <button
                                  type="button"
                                  className={`btn ${contractCustomerPartyTab === 'legal' ? 'btn-primary' : 'btn-default'}`}
                                  onClick={() => onBuyerPartyTypeChange('legal')}
                                >
                                  Юр лицо
                                </button>
                              </div>
                              <div>
                                <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>Адрес установки домокомплекта</label>
                                <textarea
                                  className="form-control"
                                  rows={2}
                                  value={contractModalCustomerForm.address ?? ''}
                                  onChange={(e) =>
                                    setContractModalCustomerForm((f) => ({ ...f, address: e.target.value || undefined }))
                                  }
                                />
                              </div>
                              {contractCustomerPartyTab === 'individual' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                                      <div>
                                        <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>Фамилия</label>
                                        <input type="text" className="form-control" value={contractModalCustomerForm.last_name ?? ''} onChange={(e) => setContractModalCustomerForm((f) => ({ ...f, last_name: e.target.value || undefined }))} />
                                      </div>
                                      <div>
                                        <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>Имя</label>
                                        <input type="text" className="form-control" value={contractModalCustomerForm.name ?? ''} onChange={(e) => setContractModalCustomerForm((f) => ({ ...f, name: e.target.value || undefined }))} />
                                      </div>
                                      <div>
                                        <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>Отчество</label>
                                        <input type="text" className="form-control" value={contractModalCustomerForm.middle_name ?? ''} onChange={(e) => setContractModalCustomerForm((f) => ({ ...f, middle_name: e.target.value || undefined }))} />
                                      </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                      <div>
                                        <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>Серия паспорта</label>
                                        <input type="text" className="form-control" value={contractModalCustomerForm.passport_series ?? ''} onChange={(e) => setContractModalCustomerForm((f) => ({ ...f, passport_series: e.target.value || undefined }))} />
                                      </div>
                                      <div>
                                        <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>Номер паспорта</label>
                                        <input type="text" className="form-control" value={contractModalCustomerForm.passport_number ?? ''} onChange={(e) => setContractModalCustomerForm((f) => ({ ...f, passport_number: e.target.value || undefined }))} />
                                      </div>
                                    </div>
                                    <div>
                                      <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>Выдан</label>
                                      <input type="text" className="form-control" value={contractModalCustomerForm.passport_issued_by ?? ''} onChange={(e) => setContractModalCustomerForm((f) => ({ ...f, passport_issued_by: e.target.value || undefined }))} />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                      <div>
                                        <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>Дата выдачи</label>
                                        <RuDateInput
                                          value={contractModalCustomerForm.passport_issue_date}
                                          onChange={(iso) =>
                                            setContractModalCustomerForm((f) => ({ ...f, passport_issue_date: iso }))
                                          }
                                        />
                                      </div>
                                      <div>
                                        <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>Код подразделения</label>
                                        <input type="text" className="form-control" value={contractModalCustomerForm.passport_department_code ?? ''} onChange={(e) => setContractModalCustomerForm((f) => ({ ...f, passport_department_code: e.target.value || undefined }))} />
                                      </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                      <div>
                                        <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>Дата рождения</label>
                                        <RuDateInput
                                          value={contractModalCustomerForm.birth_date}
                                          onChange={(iso) =>
                                            setContractModalCustomerForm((f) => ({ ...f, birth_date: iso }))
                                          }
                                        />
                                      </div>
                                      <div>
                                        <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>Место рождения</label>
                                        <input type="text" className="form-control" value={contractModalCustomerForm.birth_place ?? ''} onChange={(e) => setContractModalCustomerForm((f) => ({ ...f, birth_place: e.target.value || undefined }))} />
                                      </div>
                                    </div>
                                  </div>
                                    <div>
                                      <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>Скан паспорта</label>
                                      <div style={{ width: '100%', maxWidth: 360, height: 280, border: '1px solid #ddd', borderRadius: 8, overflow: 'hidden', backgroundColor: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {contractModalCustomer?.has_passport_scan ? (
                                          <img key={contractModalPassportScanKey} src={`${api.customers.passportScanUrl(project.customer_id)}?t=${contractModalPassportScanKey}`} alt="Скан паспорта" style={{ maxWidth: '100%', maxHeight: 280, objectFit: 'contain' }} />
                                        ) : (
                                          <span style={{ fontSize: 13, color: '#666' }}>Нет скана. Загрузите изображение (JPEG, PNG).</span>
                                        )}
                                      </div>
                                      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <input
                                          type="file" accept="image/jpeg,image/png,image/gif,image/webp" disabled={contractModalPassportScanUploading}
                                          onChange={async (e) => {
                                            const file = e.target.files?.[0]
                                            if (!file || !project?.customer_id) return
                                            setContractModalPassportScanUploading(true)
                                            try {
                                              await api.customers.uploadPassportScan(project.customer_id, file)
                                              const updated = await api.customers.get(project.customer_id)
                                              setContractModalCustomer(updated)
                                              setCustomerForPlaceholders(updated)
                                              setContractModalPassportScanKey((k) => k + 1)
                                            } catch (err) {
                                              alert(err instanceof Error ? err.message : String(err))
                                            } finally {
                                              setContractModalPassportScanUploading(false)
                                              e.target.value = ''
                                            }
                                          }}
                                        />
                                        {contractModalPassportScanUploading && <span style={{ fontSize: 13, color: '#666' }}>Загрузка…</span>}
                                        {contractModalCustomer?.has_passport_scan && (
                                          <button
                                            type="button"
                                            className="btn btn-default btn-sm"
                                            disabled={contractModalPassportScanUploading}
                                            onClick={async () => {
                                              if (!project?.customer_id) return
                                              if (!confirm('Удалить скан паспорта?')) return
                                              setContractModalPassportScanUploading(true)
                                              try {
                                                await api.customers.deletePassportScan(project.customer_id)
                                                const updated = await api.customers.get(project.customer_id)
                                                setContractModalCustomer(updated)
                                                setCustomerForPlaceholders(updated)
                                                setContractModalPassportScanKey((k) => k + 1)
                                              } catch (err) {
                                                alert(err instanceof Error ? err.message : String(err))
                                              } finally {
                                                setContractModalPassportScanUploading(false)
                                              }
                                            }}
                                          >
                                            Очистить
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                  <div>
                                    <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>Наименование организации</label>
                                    <input type="text" className="form-control" value={contractModalCustomerForm.legal_company_name ?? ''} onChange={(e) => setContractModalCustomerForm((f) => ({ ...f, legal_company_name: e.target.value || undefined }))} />
                                  </div>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                                    <div>
                                      <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>ИНН</label>
                                      <input type="text" className="form-control" value={contractModalCustomerForm.legal_inn ?? ''} onChange={(e) => setContractModalCustomerForm((f) => ({ ...f, legal_inn: e.target.value || undefined }))} />
                                    </div>
                                    <div>
                                      <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>КПП</label>
                                      <input type="text" className="form-control" value={contractModalCustomerForm.legal_kpp ?? ''} onChange={(e) => setContractModalCustomerForm((f) => ({ ...f, legal_kpp: e.target.value || undefined }))} />
                                    </div>
                                    <div>
                                      <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>ОГРН</label>
                                      <input type="text" className="form-control" value={contractModalCustomerForm.legal_ogrn ?? ''} onChange={(e) => setContractModalCustomerForm((f) => ({ ...f, legal_ogrn: e.target.value || undefined }))} />
                                    </div>
                                  </div>
                                  <div>
                                    <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>Юридический адрес</label>
                                    <textarea className="form-control" rows={2} value={contractModalCustomerForm.legal_company_address ?? ''} onChange={(e) => setContractModalCustomerForm((f) => ({ ...f, legal_company_address: e.target.value || undefined }))} />
                                  </div>
                                  <div>
                                    <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>Банк</label>
                                    <input type="text" className="form-control" value={contractModalCustomerForm.legal_bank ?? ''} onChange={(e) => setContractModalCustomerForm((f) => ({ ...f, legal_bank: e.target.value || undefined }))} />
                                  </div>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                    <div>
                                      <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>Расчётный счёт</label>
                                      <input type="text" className="form-control" value={contractModalCustomerForm.legal_bank_account ?? ''} onChange={(e) => setContractModalCustomerForm((f) => ({ ...f, legal_bank_account: e.target.value || undefined }))} />
                                    </div>
                                    <div>
                                      <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>БИК</label>
                                      <input type="text" className="form-control" value={contractModalCustomerForm.legal_bik ?? ''} onChange={(e) => setContractModalCustomerForm((f) => ({ ...f, legal_bik: e.target.value || undefined }))} />
                                    </div>
                                  </div>
                                  <div>
                                    <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>Подписант (ФИО)</label>
                                    <input type="text" className="form-control" value={contractModalCustomerForm.legal_signatory_name ?? ''} onChange={(e) => setContractModalCustomerForm((f) => ({ ...f, legal_signatory_name: e.target.value || undefined }))} />
                                  </div>
                                  <div>
                                    <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>Действует на основании</label>
                                    <input type="text" className="form-control" value={contractModalCustomerForm.legal_signatory_basis ?? ''} onChange={(e) => setContractModalCustomerForm((f) => ({ ...f, legal_signatory_basis: e.target.value || undefined }))} placeholder="Устава / доверенности № …" />
                                  </div>
                                </div>
                              )}
                              </div>
                              ) : (
                                <p style={{ flex: '1 1 300px', color: '#73879C', fontSize: 13 }}>У проекта не указан заказчик — данные клиента недоступны.</p>
                              )}
                              </div>
                              <div style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: '1px solid #eee' }}>
                                <button type="submit" className="btn btn-success" disabled={contractDataSaving}>
                                  {contractDataSaving ? 'Сохранение…' : 'Сохранить'}
                                </button>
                              </div>
                            </form>
                          )}
                        </>
                      )}
                    </div>
                </div>
              ) : editingItemId != null ? (
                <form onSubmit={handleSaveEditItem}>
                  <div className="form-group">
                    <label className="control-label">Позиция номенклатуры</label>
                    <select
                      value={editForm.nomenclature_item_id ?? ''}
                      onChange={(e) => {
                        const val = e.target.value ? parseInt(e.target.value, 10) : null
                        if (val != null) {
                          const nom = editNomenclature.find((n) => n.id === val)
                          setEditForm((f) => ({
                            ...f,
                            nomenclature_item_id: val,
                            ...(nom && {
                              item_name: (nom.name || nom.item_number || '').trim() || nom.item_number,
                              unit: nom.unit ?? f.unit,
                              price: Number(nom.total_cost) ?? f.price,
                            }),
                          }))
                        } else {
                          setEditForm((f) => ({ ...f, nomenclature_item_id: null }))
                        }
                      }}
                      className="form-control"
                    >
                      <option value="">— не выбрано —</option>
                      {editNomenclature.map((n) => {
                        const label = [n.item_number, n.name].filter(Boolean).join(' — ')
                        return (
                          <option key={n.id} value={n.id}>{label}</option>
                        )
                      })}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="control-label">Название</label>
                    <input
                      type="text"
                      value={editForm.item_name}
                      onChange={(e) => setEditForm((f) => ({ ...f, item_name: e.target.value }))}
                      className="form-control"
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <div className="form-group" style={{ minWidth: 120 }}>
                      <label className="control-label">Кол-во</label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={editForm.quantity}
                        onChange={(e) => setEditForm((f) => ({ ...f, quantity: parseFloat(e.target.value) || 0 }))}
                        className="form-control"
                      />
                    </div>
                    <div className="form-group" style={{ minWidth: 100 }}>
                      <label className="control-label">Ед.</label>
                      <input
                        type="text"
                        value={editForm.unit}
                        onChange={(e) => setEditForm((f) => ({ ...f, unit: e.target.value }))}
                        className="form-control"
                      />
                    </div>
                    <div className="form-group" style={{ minWidth: 120 }}>
                      <label className="control-label">Цена</label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={editForm.price}
                        onChange={(e) => setEditForm((f) => ({ ...f, price: parseFloat(e.target.value) || 0 }))}
                        className="form-control"
                      />
                    </div>
                  </div>
                  <div style={{ marginTop: 15 }}>
                    <button type="submit" disabled={savingItem} className="btn btn-success">
                      {savingItem ? 'Сохранение…' : 'Сохранить'}
                    </button>
                    <button type="button" onClick={() => { setEditingItemId(null); setEditNomenclature([]) }} className="btn btn-default">
                      Отмена
                    </button>
                  </div>
                </form>
              ) : (
                <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                  {renderRightColumnContent()}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showAddItemModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => !addingItem && setShowAddItemModal(false)}>
          <div
            style={{
              background: '#fff',
              padding: 24,
              borderRadius: 8,
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              width: ADD_ITEM_MODAL_WIDTH_PX,
              maxWidth: 'calc(100vw - 32px)',
              boxSizing: 'border-box',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 16px 0' }}>Добавить позицию</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontSize: 13, color: '#73879C' }}>Позиция номенклатуры</label>
                <div ref={addItemNomenclatureDropdownRef} style={{ position: 'relative' }}>
                  <button
                    type="button"
                    className="form-control"
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      paddingRight: 28,
                      backgroundImage:
                        'linear-gradient(45deg, transparent 50%, #73879C 50%), linear-gradient(135deg, #73879C 50%, transparent 50%)',
                      backgroundPosition: 'calc(100% - 14px) calc(50% - 2px), calc(100% - 9px) calc(50% - 2px)',
                      backgroundSize: '5px 5px, 5px 5px',
                      backgroundRepeat: 'no-repeat',
                    }}
                    onClick={() => setAddItemNomenclatureDropdownOpen((open) => !open)}
                  >
                    {selectedAddItemNomenclature
                      ? formatNomenclatureLabel(selectedAddItemNomenclature)
                      : '— Выберите —'}
                  </button>
                  {addItemNomenclatureDropdownOpen && (
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        top: '100%',
                        marginTop: 4,
                        zIndex: 20,
                        background: '#fff',
                        border: '1px solid #ced4da',
                        borderRadius: 6,
                        boxShadow: '0 6px 16px rgba(0,0,0,0.12)',
                        overflow: 'hidden',
                      }}
                    >
                      <input
                        type="search"
                        value={addItemNomenclatureSearch}
                        onChange={(e) => setAddItemNomenclatureSearch(e.target.value)}
                        placeholder="Поиск…"
                        className="form-control"
                        style={{ width: '100%', border: 'none', borderRadius: 0, boxShadow: 'none' }}
                        autoFocus
                      />
                      <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                        {filteredAddItemNomenclature.length === 0 ? (
                          <div style={{ padding: '12px', fontSize: 13, color: '#73879C' }}>
                            Ничего не найдено
                          </div>
                        ) : (
                          filteredAddItemNomenclature.map((n) => (
                            <button
                              key={n.id}
                              type="button"
                              onClick={() => pickAddItemNomenclature(n)}
                              style={{
                                display: 'block',
                                width: '100%',
                                textAlign: 'left',
                                padding: '8px 12px',
                                border: 'none',
                                borderBottom: '1px solid #f0f0f0',
                                background: addItemNomenclatureId === n.id ? '#e8f4fc' : '#fff',
                                fontSize: 13,
                                cursor: 'pointer',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {formatNomenclatureLabel(n)}
                            </button>
                          ))
                        )}
                      </div>
                      <p style={{ margin: 0, padding: '6px 10px', fontSize: 11, color: '#73879C', borderTop: '1px solid #E6E9ED' }}>
                        {addItemNomenclatureSearch.trim() !== ''
                          ? `Найдено: ${filteredAddItemNomenclature.length} из ${nomenclature.length}`
                          : `Всего: ${nomenclature.length}`}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 13, color: '#73879C' }}>Кол-во</label>
                  <input
                    type="number"
                    min={0.01}
                    step="0.01"
                    value={addItemQuantity}
                    onChange={(e) => setAddItemQuantity(parseFloat(e.target.value) || 0)}
                    className="form-control"
                    style={{ width: '100%' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 13, color: '#73879C' }}>Ед.</label>
                  <input
                    type="text"
                    value={addItemUnit}
                    onChange={(e) => setAddItemUnit(e.target.value)}
                    className="form-control"
                    style={{ width: '100%' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 13, color: '#73879C' }}>Цена</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={addItemPrice}
                    onChange={(e) => setAddItemPrice(parseFloat(e.target.value) || 0)}
                    className="form-control"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button type="button" onClick={() => setShowAddItemModal(false)} className="btn btn-default" disabled={addingItem}>
                Отмена
              </button>
              <button type="button" onClick={handleAddItem} className="btn btn-success" disabled={addingItem || addItemNomenclatureId === ''}>
                {addingItem ? '…' : 'Добавить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {(downloadingKpClient2 || downloadingKpClientV2 || downloadingKpStandartClient) && (
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(255, 255, 255, 0.72)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 14,
            pointerEvents: 'all',
          }}
        >
          <div className="kp-download-spinner" />
          <span style={{ fontSize: 15, color: '#2A3F54', fontWeight: 500 }}>
            {kpClientDownloadLabel}
          </span>
        </div>
      )}

    </div>
  )
}
