const API_BASE = ''

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('access_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const IMAGE_EXTENSIONS = /\.(jpe?g|png|gif|webp)$/i

function isImageUploadFile(file: File): boolean {
  if ((file.type || '').startsWith('image/')) return true
  return IMAGE_EXTENSIONS.test(file.name || '')
}

function filterImageUploadFiles(files: FileList | File[]): File[] {
  return Array.from(files).filter(isImageUploadFile)
}

async function parseAuthFetchError(res: Response, fallback: string): Promise<string> {
  const err = await res.json().catch(() => ({ detail: res.statusText }))
  return formatApiDetail((err as { detail?: unknown }).detail, fallback)
}

function formatApiDetail(detail: unknown, fallback: string): string {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (item && typeof item === 'object' && 'msg' in item) {
          const loc = 'loc' in item && Array.isArray(item.loc) ? item.loc.join('.') : ''
          return loc ? `${loc}: ${String((item as { msg: unknown }).msg)}` : String((item as { msg: unknown }).msg)
        }
        return String(item)
      })
      .join('; ')
  }
  return fallback
}

type SpecificationPhotoUploadOpts = {
  specification_id?: number
  house_specification_template_id?: number
  sort_order?: number
}

async function uploadSpecificationPhoto(file: File, opts: SpecificationPhotoUploadOpts): Promise<SpecificationPhoto> {
  const form = new FormData()
  form.append('file', file)
  if (opts.specification_id != null) form.append('specification_id', String(opts.specification_id))
  if (opts.house_specification_template_id != null) {
    form.append('house_specification_template_id', String(opts.house_specification_template_id))
  }
  if (opts.sort_order != null) form.append('sort_order', String(opts.sort_order))
  const res = await authFetch(`${API_BASE}/api/specification-photos/upload`, {
    method: 'POST',
    body: form,
  })
  if (res.status === 401) {
    localStorage.removeItem('access_token')
    localStorage.removeItem('auth_user')
    window.dispatchEvent(new Event('auth-expired'))
    throw new Error('Сессия истекла')
  }
  if (!res.ok) {
    throw new Error(await parseAuthFetchError(res, String(res.status)))
  }
  return res.json()
}

async function uploadSpecificationPhotosMany(
  files: File[],
  opts: SpecificationPhotoUploadOpts
): Promise<SpecificationPhoto[]> {
  const list = filterImageUploadFiles(files)
  if (list.length === 0) {
    throw new Error('Выберите файлы изображений (JPEG, PNG, GIF, WebP)')
  }
  const form = new FormData()
  for (const file of list) form.append('files', file)
  if (opts.specification_id != null) form.append('specification_id', String(opts.specification_id))
  if (opts.house_specification_template_id != null) {
    form.append('house_specification_template_id', String(opts.house_specification_template_id))
  }
  if (opts.sort_order != null) form.append('sort_order', String(opts.sort_order))
  const res = await authFetch(`${API_BASE}/api/specification-photos/upload-many`, {
    method: 'POST',
    body: form,
  })
  if (res.status === 401) {
    localStorage.removeItem('access_token')
    localStorage.removeItem('auth_user')
    window.dispatchEvent(new Event('auth-expired'))
    throw new Error('Сессия истекла')
  }
  if (res.ok) {
    return res.json()
  }
  if (res.status === 404 || res.status === 405) {
    const uploaded: SpecificationPhoto[] = []
    for (let i = 0; i < list.length; i++) {
      uploaded.push(
        await uploadSpecificationPhoto(list[i], {
          ...opts,
          sort_order: (opts.sort_order ?? 0) + i,
        })
      )
    }
    return uploaded
  }
  throw new Error(await parseAuthFetchError(res, String(res.status)))
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...options?.headers,
    },
  })
  if (res.status === 401 && !path.startsWith('/api/auth/')) {
    localStorage.removeItem('access_token')
    localStorage.removeItem('auth_user')
    window.dispatchEvent(new Event('auth-expired'))
    throw new Error('Сессия истекла')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    const detail = (err as { detail?: unknown }).detail
    throw new Error(formatApiDetail(detail, res.statusText || String(res.status)))
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

function authFetch(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: {
      ...getAuthHeaders(),
      ...init?.headers,
    },
  })
}

export const api = {
  health: () => request<{ status: string }>('/health'),
  healthDb: () => request<{ status: string; db: string }>('/health/db'),
  customers: {
    list: (params?: { skip?: number; limit?: number; deal_status?: string[] }) => {
      const p = new URLSearchParams()
      if (params?.skip != null) p.set('skip', String(params.skip))
      if (params?.limit != null) p.set('limit', String(params.limit))
      if (params?.deal_status?.length) {
        for (const s of params.deal_status) {
          p.append('deal_status', s)
        }
      }
      const q = p.toString()
      return request<Customer[]>(`/api/customers${q ? `?${q}` : ''}`)
    },
    checkPhone: (phone: string) =>
      request<{ exists: boolean }>(`/api/customers/check-phone?phone=${encodeURIComponent(phone)}`),
    get: (id: number) => request<Customer>(`/api/customers/${id}`),
    create: (data: CustomerCreate) =>
      request<Customer>('/api/customers', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<CustomerCreate>) =>
      request<Customer>(`/api/customers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<void>(`/api/customers/${id}`, { method: 'DELETE' }),
    uploadPassportScan: async (id: number, file: File): Promise<void> => {
      const form = new FormData()
      form.append('file', file)
      const res = await authFetch(`/api/customers/${id}/passport-scan`, {
        method: 'POST',
        body: form,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error((err as { detail?: string }).detail || String(res.status))
      }
    },
    deletePassportScan: (id: number) =>
      request<void>(`/api/customers/${id}/passport-scan`, { method: 'DELETE' }),
    passportScanUrl: (id: number) => {
      const token = localStorage.getItem('access_token')
      return `/api/customers/${id}/passport-scan${token ? `?token=${encodeURIComponent(token)}` : ''}`
    },
  },
  branches: {
    list: () => request<Branch[]>('/api/branches'),
    get: (id: number) => request<Branch>(`/api/branches/${id}`),
    create: (data: BranchCreate) =>
      request<Branch>('/api/branches', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<BranchCreate>) =>
      request<Branch>(`/api/branches/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<void>(`/api/branches/${id}`, { method: 'DELETE' }),
  },
  leadSources: {
    list: () => request<LeadSource[]>('/api/lead-sources'),
    get: (id: number) => request<LeadSource>(`/api/lead-sources/${id}`),
    create: (data: LeadSourceCreate) =>
      request<LeadSource>('/api/lead-sources', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<LeadSourceCreate>) =>
      request<LeadSource>(`/api/lead-sources/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<void>(`/api/lead-sources/${id}`, { method: 'DELETE' }),
  },
  specificationStatuses: {
    list: () => request<SpecificationStatus[]>('/api/specification-statuses'),
    get: (id: number) => request<SpecificationStatus>(`/api/specification-statuses/${id}`),
    create: (data: SpecificationStatusCreate) =>
      request<SpecificationStatus>('/api/specification-statuses', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<SpecificationStatusCreate>) =>
      request<SpecificationStatus>(`/api/specification-statuses/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<void>(`/api/specification-statuses/${id}`, { method: 'DELETE' }),
  },
  projectStatuses: {
    list: () => request<ProjectStatus[]>('/api/project-statuses'),
    get: (id: number) => request<ProjectStatus>(`/api/project-statuses/${id}`),
    create: (data: ProjectStatusCreate) =>
      request<ProjectStatus>('/api/project-statuses', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<ProjectStatusCreate>) =>
      request<ProjectStatus>(`/api/project-statuses/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<void>(`/api/project-statuses/${id}`, { method: 'DELETE' }),
  },
  projectStatusLogs: {
    list: (params?: { skip?: number; limit?: number; project_id?: number }) => {
      const p = new URLSearchParams()
      if (params?.skip != null) p.set('skip', String(params.skip))
      if (params?.limit != null) p.set('limit', String(params.limit))
      if (params?.project_id != null) p.set('project_id', String(params.project_id))
      const q = p.toString()
      return request<ProjectStatusLog[]>(`/api/project-status-logs${q ? `?${q}` : ''}`)
    },
  },
  projects: {
    list: (params?: { customer_id?: number; status_id?: number; skip?: number; limit?: number }) => {
      const p = new URLSearchParams()
      if (params?.customer_id != null) p.set('customer_id', String(params.customer_id))
      if (params?.status_id != null) p.set('status_id', String(params.status_id))
      if (params?.skip != null) p.set('skip', String(params.skip))
      if (params?.limit != null) p.set('limit', String(params.limit))
      const q = p.toString()
      return request<Project[]>(`/api/projects${q ? `?${q}` : ''}`)
    },
    get: (id: number) => request<Project>(`/api/projects/${id}`),
    getConsolidatedKp: (projectId: number) =>
      request<ConsolidatedKpGroup[]>(`/api/projects/${projectId}/consolidated-kp`),
    getContractData: (projectId: number) =>
      request<ProjectContractData>(`/api/projects/${projectId}/contract-data`),
    updateContractData: (projectId: number, data: ProjectContractDataUpdate) =>
      request<ProjectContractData>(`/api/projects/${projectId}/contract-data`, { method: 'PATCH', body: JSON.stringify(data) }),
    listContractDocuments: (projectId: number) =>
      request<ProjectContractDocument[]>(`/api/projects/${projectId}/contract-documents`),
    getContractDocument: (projectId: number, documentId: string) =>
      request<ProjectContractDocument>(`/api/projects/${projectId}/contract-documents/${documentId}`),
    updateContractDocument: (
      projectId: number,
      documentId: string,
      data: { html_body?: string | null }
    ) =>
      request<ProjectContractDocument>(`/api/projects/${projectId}/contract-documents/${documentId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    syncContractDocuments: (
      projectId: number,
      params?: { document_id?: string; overwrite?: boolean }
    ) => {
      const p = new URLSearchParams()
      if (params?.document_id) p.set('document_id', params.document_id)
      if (params?.overwrite) p.set('overwrite', 'true')
      const q = p.toString()
      return request<Record<string, boolean> | { document_id: string; copied: boolean }>(
        `/api/projects/${projectId}/sync-contract-documents${q ? `?${q}` : ''}`,
        { method: 'POST' }
      )
    },
    contractDocumentPdf: async (
      projectId: number,
      body: {
        document_id: string
        html_body?: string | null
        contract_data?: ProjectContractDataUpdate | null
        customer?: Record<string, unknown> | null
        specification_id?: number | null
        filename?: string | null
      }
    ): Promise<Blob> => {
      const res = await authFetch(`${API_BASE}/api/projects/${projectId}/contract-document-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error((err as { detail?: string }).detail || String(res.status))
      }
      return res.blob()
    },
    create: (data: ProjectCreate) =>
      request<Project>('/api/projects', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<ProjectCreate>) =>
      request<Project>(`/api/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<void>(`/api/projects/${id}`, { method: 'DELETE' }),
  },
  amountToWords: (amount: number | string) =>
    request<{ words: string }>(`/api/amount-to-words?amount=${encodeURIComponent(String(amount))}`),
  generatePdf: async (
    html: string,
    filename?: string,
    options?: {
      top?: string
      bottom?: string
      left?: string
      right?: string
      landscape?: boolean
      footer_template?: string | null
      display_header_footer?: boolean
    }
  ): Promise<Blob> => {
    const body = JSON.stringify({
      html,
      filename: filename ?? 'document',
      landscape: options?.landscape,
      margin_top: options?.top,
      margin_bottom: options?.bottom,
      margin_left: options?.left,
      margin_right: options?.right,
      footer_template: options?.footer_template,
      display_header_footer: options?.display_header_footer,
    })
    const res = await authFetch(`${API_BASE}/api/generate-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }))
      throw new Error((err as { detail?: string }).detail || String(res.status))
    }
    return res.blob()
  },
  organizations: {
    list: (params?: { skip?: number; limit?: number; company_id?: number }) => {
      const p = new URLSearchParams()
      if (params?.skip != null) p.set('skip', String(params.skip))
      if (params?.limit != null) p.set('limit', String(params.limit))
      if (params?.company_id != null) p.set('company_id', String(params.company_id))
      const q = p.toString()
      return request<Organization[]>(`/api/organizations${q ? `?${q}` : ''}`)
    },
    getDefault: (companyId?: number) => {
      const q = companyId != null ? `?company_id=${companyId}` : ''
      return request<Organization | null>(`/api/organizations/default${q}`)
    },
    get: (id: number) => request<Organization>(`/api/organizations/${id}`),
    create: (data: OrganizationCreate) =>
      request<Organization>('/api/organizations', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<OrganizationCreate>) =>
      request<Organization>(`/api/organizations/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<void>(`/api/organizations/${id}`, { method: 'DELETE' }),
  },
  companies: {
    list: (params?: { skip?: number; limit?: number }) => {
      const p = new URLSearchParams()
      if (params?.skip != null) p.set('skip', String(params.skip))
      if (params?.limit != null) p.set('limit', String(params.limit))
      const q = p.toString()
      return request<Company[]>(`/api/companies${q ? `?${q}` : ''}`)
    },
    get: (id: number) => request<Company>(`/api/companies/${id}`),
    listOrganizations: (id: number) =>
      request<Organization[]>(`/api/companies/${id}/organizations`),
    create: (data: CompanyCreate) =>
      request<Company>('/api/companies', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<CompanyCreate>) =>
      request<Company>(`/api/companies/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<void>(`/api/companies/${id}`, { method: 'DELETE' }),
  },
  kpHtmlTemplates: {
    list: (params?: { skip?: number; limit?: number }) => {
      const p = new URLSearchParams()
      if (params?.skip != null) p.set('skip', String(params.skip))
      if (params?.limit != null) p.set('limit', String(params.limit))
      const q = p.toString()
      return request<KpHtmlTemplate[]>(`/api/kp-html-templates${q ? `?${q}` : ''}`)
    },
    get: (id: number) => request<KpHtmlTemplate>(`/api/kp-html-templates/${id}`),
    create: (data: KpHtmlTemplateCreate) =>
      request<KpHtmlTemplate>('/api/kp-html-templates', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<KpHtmlTemplateUpdate>) =>
      request<KpHtmlTemplate>(`/api/kp-html-templates/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<void>(`/api/kp-html-templates/${id}`, { method: 'DELETE' }),
  },
  contractTemplates: {
    list: (params?: { skip?: number; limit?: number }) => {
      const p = new URLSearchParams()
      if (params?.skip != null) p.set('skip', String(params.skip))
      if (params?.limit != null) p.set('limit', String(params.limit))
      const q = p.toString()
      return request<ContractTemplate[]>(`/api/contract-templates${q ? `?${q}` : ''}`)
    },
    getByCode: (code: string) => request<ContractTemplate>(`/api/contract-templates/by-code/${code}`),
    get: (id: number) => request<ContractTemplate>(`/api/contract-templates/${id}`),
    create: (data: ContractTemplateCreate) =>
      request<ContractTemplate>('/api/contract-templates', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<ContractTemplateUpdate>) =>
      request<ContractTemplate>(`/api/contract-templates/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    reorder: (ids: number[]) =>
      request<ContractTemplate[]>('/api/contract-templates/reorder', { method: 'PUT', body: JSON.stringify({ ids }) }),
    delete: (id: number) =>
      request<void>(`/api/contract-templates/${id}`, { method: 'DELETE' }),
  },
  printSettings: {
    get: () => request<PrintSettings>('/api/print-settings'),
    update: (data: Partial<PrintSettingsUpdate>) =>
      request<PrintSettings>('/api/print-settings', { method: 'PATCH', body: JSON.stringify(data) }),
  },
  specifications: {
    list: (params?: { project_id?: number }) => {
      const p = new URLSearchParams()
      if (params?.project_id != null) p.set('project_id', String(params.project_id))
      const q = p.toString()
      return request<Specification[]>(`/api/specifications${q ? `?${q}` : ''}`)
    },
    create: (data: SpecificationCreate) =>
      request<Specification>('/api/specifications', { method: 'POST', body: JSON.stringify(data) }),
    update: (specificationId: number, data: SpecificationUpdate) =>
      request<Specification>(`/api/specifications/${specificationId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    duplicate: (specificationId: number) =>
      request<Specification>(`/api/specifications/${specificationId}/duplicate`, { method: 'POST' }),
    delete: (specificationId: number) =>
      request<void>(`/api/specifications/${specificationId}`, { method: 'DELETE' }),
    listItems: (specificationId: number) =>
      request<SpecificationItem[]>(`/api/specifications/${specificationId}/items`),
    addItem: (specificationId: number, data: SpecificationItemAddBody) =>
      request<SpecificationItem>(`/api/specifications/${specificationId}/items`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    updateItem: (specificationId: number, itemId: number, data: Partial<SpecificationItemUpdate>) =>
      request<SpecificationItem>(
        `/api/specifications/${specificationId}/items/${itemId}`,
        { method: 'PATCH', body: JSON.stringify(data) }
      ),
    deleteItem: (specificationId: number, itemId: number) =>
      request<void>(`/api/specifications/${specificationId}/items/${itemId}`, { method: 'DELETE' }),
    downloadKpOverlayPdf: async (specificationId: number): Promise<void> => {
      const res = await authFetch(`${API_BASE}/api/specifications/${specificationId}/kp-overlay-pdf`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error((err as { detail?: string }).detail || String(res.status))
      }
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition')
      const match = disposition?.match(/filename="?([^";\n]+)"?/)
      const filename = match ? match[1].trim() : `kp_overlay_${specificationId}.pdf`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    },
    downloadKpOverlayClientPdf: async (specificationId: number): Promise<void> => {
      const res = await authFetch(`${API_BASE}/api/specifications/${specificationId}/kp-overlay-client-pdf`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error((err as { detail?: string }).detail || String(res.status))
      }
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition')
      const match = disposition?.match(/filename="?([^";\n]+)"?/)
      const filename = match ? match[1].trim() : `kp_client_${specificationId}.pdf`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    },
    downloadKpOverlayClientV2Pdf: async (specificationId: number): Promise<void> => {
      const res = await authFetch(`${API_BASE}/api/specifications/${specificationId}/kp-overlay-client-v2-pdf`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error((err as { detail?: string }).detail || String(res.status))
      }
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition')
      const match = disposition?.match(/filename="?([^";\n]+)"?/)
      const filename = match ? match[1].trim() : `kp_client_v2_${specificationId}.pdf`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    },
    downloadKpStandartClientPdf: async (specificationId: number): Promise<void> => {
      const res = await authFetch(
        `${API_BASE}/api/specifications/${specificationId}/kp-standart-client-pdf`,
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error((err as { detail?: string }).detail || String(res.status))
      }
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition')
      const match = disposition?.match(/filename="?([^";\n]+)"?/)
      const filename = match ? match[1].trim() : `kp_standart_client_${specificationId}.pdf`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    },
    downloadKpOverlayClient2Pdf: async (specificationId: number): Promise<void> => {
      const res = await authFetch(`${API_BASE}/api/specifications/${specificationId}/kp-overlay-client2-pdf`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error((err as { detail?: string }).detail || String(res.status))
      }
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition')
      const match = disposition?.match(/filename="?([^";\n]+)"?/)
      const filename = match ? match[1].trim() : `kp_client_${specificationId}.pdf`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    },
    downloadKpOverlayConsolidatedPdf: async (specificationId: number): Promise<void> => {
      const res = await authFetch(`${API_BASE}/api/specifications/${specificationId}/kp-overlay-consolidated-pdf`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error((err as { detail?: string }).detail || String(res.status))
      }
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition')
      const match = disposition?.match(/filename="?([^";\n]+)"?/)
      const filename = match ? match[1].trim() : `kp_consolidated_${specificationId}.pdf`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    },
    downloadKpPdf: async (specificationId: number): Promise<void> => {
      const res = await authFetch(`${API_BASE}/api/specifications/${specificationId}/kp-pdf`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error((err as { detail?: string }).detail || String(res.status))
      }
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition')
      const match = disposition?.match(/filename="?([^";\n]+)"?/)
      const filename = match ? match[1].trim() : `kp_spec_${specificationId}.pdf`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    },
    downloadContractPdf: async (specificationId: number): Promise<void> => {
      const res = await authFetch(`${API_BASE}/api/specifications/${specificationId}/contract-pdf`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error((err as { detail?: string }).detail || String(res.status))
      }
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition')
      const match = disposition?.match(/filename="?([^";\n]+)"?/)
      const filename = match ? match[1].trim() : `dogovor_postavki_spec_${specificationId}.pdf`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    },
    getKpHtml: async (specificationId: number): Promise<string> => {
      const res = await authFetch(`${API_BASE}/api/specifications/${specificationId}/kp-html`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error((err as { detail?: string }).detail || String(res.status))
      }
      return res.text()
    },
    getKpPhotoHtml: async (specificationId: number): Promise<string> => {
      const res = await authFetch(`${API_BASE}/api/specifications/${specificationId}/kp-photo-html`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error((err as { detail?: string }).detail || String(res.status))
      }
      return res.text()
    },
    getKpPhotoNoPriceHtml: async (specificationId: number): Promise<string> => {
      const res = await authFetch(`${API_BASE}/api/specifications/${specificationId}/kp-photo-noprice-html`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error((err as { detail?: string }).detail || String(res.status))
      }
      return res.text()
    },
    applyHouseTemplate: (specificationId: number, houseSpecificationTemplateId: number) =>
      request<SpecificationItem[]>(
        `/api/specifications/${specificationId}/apply-house-template`,
        { method: 'POST', body: JSON.stringify({ house_specification_template_id: houseSpecificationTemplateId }) }
      ),
  },
  parts: {
    list: () => request<Part[]>('/api/parts'),
    get: (id: number) => request<Part>(`/api/parts/${id}`),
    create: (data: PartCreate) =>
      request<Part>('/api/parts', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: PartUpdate) =>
      request<Part>(`/api/parts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    reorder: (ids: number[]) =>
      request<Part[]>('/api/parts/reorder', { method: 'PUT', body: JSON.stringify({ ids }) }),
    delete: (id: number) => request<void>(`/api/parts/${id}`, { method: 'DELETE' }),
  },
  nomenclatureItems: {
    list: (params?: { skip?: number; limit?: number; part_id?: number }) => {
      const p = new URLSearchParams()
      if (params?.skip != null) p.set('skip', String(params.skip))
      if (params?.limit != null) p.set('limit', String(params.limit))
      if (params?.part_id != null) p.set('part_id', String(params.part_id))
      const q = p.toString()
      return request<NomenclatureItem[]>(`/api/nomenclature-items${q ? `?${q}` : ''}`)
    },
    get: (id: number) => request<NomenclatureItem>(`/api/nomenclature-items/${id}`),
    create: (data: NomenclatureItemCreate) =>
      request<NomenclatureItem>('/api/nomenclature-items', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: NomenclatureItemUpdate) =>
      request<NomenclatureItem>(`/api/nomenclature-items/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<void>(`/api/nomenclature-items/${id}`, { method: 'DELETE' }),
  },
  requiredItemTemplates: {
    list: () => request<RequiredItemTemplate[]>('/api/required-item-templates'),
    get: (id: number) => request<RequiredItemTemplate>(`/api/required-item-templates/${id}`),
    create: (data: RequiredItemTemplateCreate) =>
      request<RequiredItemTemplate>('/api/required-item-templates', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: RequiredItemTemplateUpdate) =>
      request<RequiredItemTemplate>(`/api/required-item-templates/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<void>(`/api/required-item-templates/${id}`, { method: 'DELETE' }),
  },
  houseSpecificationTemplates: {
    list: () => request<HouseSpecificationTemplate[]>('/api/house-specification-templates'),
    get: (id: number) => request<HouseSpecificationTemplate>(`/api/house-specification-templates/${id}`),
    create: (data: HouseSpecificationTemplateCreate) =>
      request<HouseSpecificationTemplate>('/api/house-specification-templates', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: HouseSpecificationTemplateUpdate) =>
      request<HouseSpecificationTemplate>(`/api/house-specification-templates/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<void>(`/api/house-specification-templates/${id}`, { method: 'DELETE' }),
  },
  houseTemplates: {
    list: () => request<HouseTemplate[]>('/api/house-templates'),
    get: (id: number) => request<HouseTemplate>(`/api/house-templates/${id}`),
    create: (data: HouseTemplateCreate) =>
      request<HouseTemplate>('/api/house-templates', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: HouseTemplateUpdate) =>
      request<HouseTemplate>(`/api/house-templates/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<void>(`/api/house-templates/${id}`, { method: 'DELETE' }),
  },
  requiredItemMaterials: {
    list: (params?: { template_id?: number }) => {
      const p = new URLSearchParams()
      if (params?.template_id != null) p.set('template_id', String(params.template_id))
      const q = p.toString()
      return request<RequiredItemMaterial[]>(`/api/required-item-materials${q ? `?${q}` : ''}`)
    },
    get: (id: number) => request<RequiredItemMaterial>(`/api/required-item-materials/${id}`),
    create: (data: RequiredItemMaterialCreate) =>
      request<RequiredItemMaterial>('/api/required-item-materials', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: RequiredItemMaterialUpdate) =>
      request<RequiredItemMaterial>(`/api/required-item-materials/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    delete: (id: number) =>
      request<void>(`/api/required-item-materials/${id}`, { method: 'DELETE' }),
  },
  specificationRequiredItems: {
    list: (params?: { spec_id?: number; skip?: number; limit?: number }) => {
      const p = new URLSearchParams()
      if (params?.spec_id != null) p.set('spec_id', String(params.spec_id))
      if (params?.skip != null) p.set('skip', String(params.skip))
      if (params?.limit != null) p.set('limit', String(params.limit))
      const q = p.toString()
      return request<SpecificationRequiredItem[]>(`/api/specification-required-items${q ? `?${q}` : ''}`)
    },
    get: (id: number) => request<SpecificationRequiredItem>(`/api/specification-required-items/${id}`),
    create: (data: SpecificationRequiredItemCreate) =>
      request<SpecificationRequiredItem>('/api/specification-required-items', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: SpecificationRequiredItemUpdate) =>
      request<SpecificationRequiredItem>(`/api/specification-required-items/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<void>(`/api/specification-required-items/${id}`, { method: 'DELETE' }),
  },
  auth: {
    login: (login: string, password: string) =>
      request<LoginResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify({ login, password }) }),
    me: () => request<AuthUserOut>('/api/auth/me'),
    updateProfile: (data: {
      email?: string | null
      current_password?: string
      new_password?: string
    }) =>
      request<AuthUserOut>('/api/auth/me/profile', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    getDashboardColumns: () =>
      request<{ order: string[]; hidden: string[] }>('/api/auth/me/dashboard-columns'),
    saveDashboardColumns: (data: { order: string[]; hidden: string[] }) =>
      request<{ order: string[]; hidden: string[] }>('/api/auth/me/dashboard-columns', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    hasUsers: () => request<{ has_users: boolean }>('/api/auth/has-users'),
    setup: (data: { nic: string; password: string; first_name?: string; last_name?: string; email?: string }) =>
      request<LoginResponse>('/api/auth/setup', { method: 'POST', body: JSON.stringify(data) }),
    registerInvite: (data: RegisterInviteRequest) =>
      request<LoginResponse>('/api/auth/register-invite', { method: 'POST', body: JSON.stringify(data) }),
    registerByLink: (data: RegisterByLinkRequest) =>
      request<LoginResponse>('/api/auth/register-by-link', { method: 'POST', body: JSON.stringify(data) }),
  },
  registerLinks: {
    preview: (ref: string) =>
      request<RegisterLinkPreview>(`/api/register-links/preview?ref=${encodeURIComponent(ref)}`),
    captcha: () => request<CaptchaChallenge>('/api/register-links/captcha'),
  },
  invites: {
    preview: (token: string) =>
      request<InvitePreview>(`/api/invites/preview?token=${encodeURIComponent(token)}`),
    list: () => request<InviteOut[]>('/api/invites'),
    create: (data: InviteCreate) =>
      request<InviteOut>('/api/invites', { method: 'POST', body: JSON.stringify(data) }),
    cancel: (id: number) =>
      request<void>(`/api/invites/${id}`, { method: 'DELETE' }),
  },
  team: {
    members: () => request<TeamMemberOut[]>('/api/team/members'),
    limits: () => request<TeamLimits>('/api/team/limits'),
    activity: (day?: string) => {
      const q = day ? `?day=${encodeURIComponent(day)}` : ''
      return request<TeamActivityOut>(`/api/team/activity${q}`)
    },
    activityDetails: (params: { user_id: number; event_type: string; day?: string; limit?: number }) => {
      const p = new URLSearchParams()
      p.set('user_id', String(params.user_id))
      p.set('event_type', params.event_type)
      if (params.day) p.set('day', params.day)
      if (params.limit != null) p.set('limit', String(params.limit))
      return request<ActivityDetailOut[]>(`/api/team/activity/details?${p.toString()}`)
    },
    registrationLink: () => request<RegistrationLinkOut>('/api/team/registration-link'),
    ensureRegistrationLink: () =>
      request<RegistrationLinkOut>('/api/team/registration-link/ensure', { method: 'POST' }),
    regenerateRegistrationLink: () =>
      request<RegistrationLinkOut>('/api/team/registration-link/generate', { method: 'POST' }),
    setRegistrationLinkEnabled: (enabled: boolean) =>
      request<RegistrationLinkOut>('/api/team/registration-link', {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
      }),
    registrationLinkQrUrl: () => {
      const token = localStorage.getItem('access_token')
      return `${API_BASE}/api/team/registration-link/qr${token ? `?token=${encodeURIComponent(token)}` : ''}`
    },
  },
  notifications: {
    list: (opts?: { unread_only?: boolean; limit?: number }) => {
      const p = new URLSearchParams()
      if (opts?.unread_only) p.set('unread_only', 'true')
      if (opts?.limit != null) p.set('limit', String(opts.limit))
      const q = p.toString()
      return request<NotificationOut[]>(`/api/notifications${q ? `?${q}` : ''}`)
    },
    unreadCount: () => request<{ count: number }>('/api/notifications/unread-count'),
    markRead: (id: number) =>
      request<NotificationOut>(`/api/notifications/${id}/read`, { method: 'PATCH' }),
    readAll: () => request<{ count: number }>('/api/notifications/read-all', { method: 'POST' }),
  },
  chat: {
    unreadCount: () => request<{ count: number }>('/api/chat/unread-count'),
    dialogs: () => request<ChatDialogOut[]>('/api/chat/dialogs'),
    messages: (threadId: number, opts?: { limit?: number; before_id?: number }) => {
      const p = new URLSearchParams()
      if (opts?.limit != null) p.set('limit', String(opts.limit))
      if (opts?.before_id != null) p.set('before_id', String(opts.before_id))
      const q = p.toString()
      return request<ChatMessageOut[]>(`/api/chat/threads/${threadId}/messages${q ? `?${q}` : ''}`)
    },
    send: (threadId: number, body: string) =>
      request<ChatMessageOut>(`/api/chat/threads/${threadId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      }),
    sendWithPhotos: async (threadId: number, files: File[], body?: string) => {
      const list = filterImageUploadFiles(files)
      if (list.length === 0) {
        throw new Error('Выберите файлы изображений (JPEG, PNG, GIF, WebP)')
      }
      const form = new FormData()
      for (const file of list) form.append('files', file)
      if (body?.trim()) form.append('body', body.trim())
      const res = await authFetch(
        `${API_BASE}/api/chat/threads/${threadId}/messages/with-photos`,
        { method: 'POST', body: form },
      )
      if (res.status === 401) {
        localStorage.removeItem('access_token')
        localStorage.removeItem('auth_user')
        window.dispatchEvent(new Event('auth-expired'))
        throw new Error('Сессия истекла')
      }
      if (!res.ok) {
        throw new Error(await parseAuthFetchError(res, String(res.status)))
      }
      return res.json() as Promise<ChatMessageOut>
    },
    attachmentImageUrl: (attachmentId: number) => {
      const token = localStorage.getItem('access_token')
      return `/api/chat/attachments/${attachmentId}/image${
        token ? `?token=${encodeURIComponent(token)}` : ''
      }`
    },
    markRead: (threadId: number, lastMessageId: number) =>
      request<void>(`/api/chat/threads/${threadId}/read`, {
        method: 'POST',
        body: JSON.stringify({ last_message_id: lastMessageId }),
      }),
  },
  users: {
    list: () => request<AuthUserOut[]>('/api/users'),
    create: (data: UserCreate) =>
      request<AuthUserOut>('/api/users', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: UserUpdate) =>
      request<AuthUserOut>(`/api/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<void>(`/api/users/${id}`, { method: 'DELETE' }),
    roles: () => request<UserRoleOut[]>('/api/users/roles'),
  },
  specificationPhotos: {
    listBySpec: (specId: number) =>
      request<SpecificationPhoto[]>(`/api/specification-photos/by-specification/${specId}`),
    listByTemplate: (templateId: number) =>
      request<SpecificationPhoto[]>(`/api/specification-photos/by-template/${templateId}`),
    imageUrl: (photoId: number) => {
      const token = localStorage.getItem('access_token')
      return `${API_BASE}/api/specification-photos/${photoId}/image${token ? `?token=${encodeURIComponent(token)}` : ''}`
    },
    upload: (file: File, opts: SpecificationPhotoUploadOpts) => uploadSpecificationPhoto(file, opts),
    uploadMany: (files: File[], opts: SpecificationPhotoUploadOpts) => uploadSpecificationPhotosMany(files, opts),
    updateSort: (photoId: number, sort_order: number) =>
      request<SpecificationPhoto>(`/api/specification-photos/${photoId}`, { method: 'PATCH', body: JSON.stringify({ sort_order }) }),
    delete: (photoId: number) =>
      request<void>(`/api/specification-photos/${photoId}`, { method: 'DELETE' }),
  },
  schemaspy: {
    status: () =>
      request<{ ready: boolean; generated_at: string; url: string; log?: string }>(
        '/api/dev/schemaspy/status',
      ),
    generate: () =>
      request<{ ready: boolean; generated_at: string; url: string; log?: string }>(
        '/api/dev/schemaspy/generate',
        { method: 'POST', body: '{}' },
      ),
  },
}

export type CustomerDealStatus = 'in_progress' | 'success' | 'rejected'

export const CUSTOMER_DEAL_STATUS_LABELS: Record<CustomerDealStatus, string> = {
  in_progress: 'В работе',
  success: 'Успех',
  rejected: 'Отказ',
}

export type CustomerGender = 'male' | 'female'

export const CUSTOMER_GENDER_LABELS: Record<CustomerGender, string> = {
  male: 'Мужчина',
  female: 'Женщина',
}

export type CustomerAgeBracket = '18_24' | '25_30' | '31_40' | '41_50' | '51_plus'

export const CUSTOMER_AGE_BRACKET_LABELS: Record<CustomerAgeBracket, string> = {
  '18_24': '18–24',
  '25_30': '25–30',
  '31_40': '31–40',
  '41_50': '41–50',
  '51_plus': '51+',
}

export interface Customer {
  id: number
  number?: string | null  // человекочитаемый A00001
  name: string
  middle_name?: string | null
  last_name?: string | null
  full_name?: string | null
  phone: string
  email?: string | null
  address: string
  deal_status: CustomerDealStatus
  gender?: CustomerGender | null
  age_bracket?: CustomerAgeBracket | null
  lead_source_id?: number | null
  link?: string | null
  notes?: string | null
  comments?: string | null
  budget?: number | null
  passport_series?: string | null
  passport_number?: string | null
  passport_issued_by?: string | null
  passport_issue_date?: string | null  // YYYY-MM-DD
  passport_department_code?: string | null
  birth_date?: string | null  // YYYY-MM-DD
  birth_place?: string | null
  passport_scan?: string | null
  has_passport_scan?: boolean
  legal_company_name?: string | null
  legal_inn?: string | null
  legal_kpp?: string | null
  legal_ogrn?: string | null
  legal_company_address?: string | null
  legal_bank?: string | null
  legal_bank_account?: string | null
  legal_bik?: string | null
  legal_signatory_name?: string | null
  legal_signatory_basis?: string | null
  created_by_user_id?: number | null
  created_by_name?: string | null
  created_on?: string | null
  modified_on?: string | null
}

export type CustomerCreate = Omit<Customer, 'id' | 'full_name' | 'created_on' | 'modified_on'> & {
  full_name?: never
  created_on?: never
  modified_on?: never
}

export interface Branch {
  id: number
  name: string
  address?: string | null
  phone?: string | null
  email?: string | null
  is_active: boolean
  sort_order: number
}

export type BranchCreate = Omit<Branch, 'id'> & { id?: never }

export interface LeadSource {
  id: number
  name: string
  is_active: boolean
  sort_order: number
}

export type LeadSourceCreate = Omit<LeadSource, 'id'> & { id?: never }

export interface SpecificationStatus {
  id: number
  name: string
  description?: string | null
  sort_order: number
  is_active: boolean
}

export interface SpecificationStatusCreate {
  name: string
  description?: string | null
  sort_order?: number
  is_active?: boolean
}

export interface ProjectStatus {
  id: number
  name: string
  description?: string | null
  /** Действие */
  action?: string | null
  /** Время исполнения (дней) */
  execution_days?: number | null
  sort_order: number
  is_active: boolean
}

export interface ProjectStatusCreate {
  name: string
  description?: string | null
  action?: string | null
  execution_days?: number | null
  sort_order?: number
  is_active?: boolean
}

export interface Project {
  id: number
  name: string
  customer_id?: number | null
  project_number?: string | null
  start_date?: string | null
  end_date?: string | null
  status_id?: number | null
  status_started_at?: string | null
  budget?: number | null
  total_amount?: number | null
  description?: string | null
  notes?: string | null
  organization_id_supply?: number | null
  organization_id_mount?: number | null
  created_by_user_id?: number | null
  created_by_name?: string | null
  created_on?: string | null
  modified_on?: string | null
  /** Сумма total_amount по всем спецификациям проекта (с бэкенда для дашборда). */
  specifications_total_amount?: number | null
  status_execution_days?: number | null
  status_remaining_seconds?: number | null
  status_sla_overdue?: boolean | null
  /** Действие текущего статуса (с бэкенда, с fallback по названию статуса). */
  status_action?: string | null
}

export interface ProjectCreate {
  name: string
  customer_id?: number | null
  project_number?: string | null
  start_date?: string | null
  end_date?: string | null
  status_id?: number | null
  budget?: number | null
  description?: string | null
  notes?: string | null
  organization_id_supply?: number | null
  organization_id_mount?: number | null
}

export interface ProjectContractDocument {
  id: number
  project_id: number
  document_id: string
  html_body?: string | null
  created_on?: string | null
  modified_on?: string | null
}

export interface Organization {
  id: number
  company_id?: number | null
  company_name?: string | null
  name: string
  inn?: string | null
  kpp?: string | null
  address?: string | null
  bank?: string | null
  bank_account?: string | null
  bik?: string | null
  director_name?: string | null
  director_position?: string | null
  is_default?: boolean
  created_on?: string | null
  modified_on?: string | null
}

export interface OrganizationCreate {
  company_id?: number | null
  name: string
  inn?: string | null
  kpp?: string | null
  address?: string | null
  bank?: string | null
  bank_account?: string | null
  bik?: string | null
  director_name?: string | null
  director_position?: string | null
  is_default?: boolean
}

export interface Company {
  id: number
  name: string
  code?: string | null
  description?: string | null
  is_active: boolean
  created_on?: string | null
  modified_on?: string | null
}

export type CompanyCreate = Omit<Company, 'id' | 'created_on' | 'modified_on'>

export interface KpHtmlTemplate {
  id: number
  title: string
  html_content?: string | null
  description?: string | null
  created_on?: string | null
  modified_on?: string | null
}

export interface KpHtmlTemplateCreate {
  title: string
  html_content?: string | null
  description?: string | null
}

export interface KpHtmlTemplateUpdate {
  title?: string | null
  html_content?: string | null
  description?: string | null
}

export interface ContractTemplate {
  id: number
  code: string
  title: string
  body?: string | null
  sort_order?: number
  created_on?: string | null
  modified_on?: string | null
}

export interface ContractTemplateCreate {
  code: string
  title: string
  body?: string | null
}

export interface ContractTemplateUpdate {
  code?: string | null
  title?: string | null
  body?: string | null
}

export interface ProjectContractData {
  id: number
  project_id: number
  contract_date?: string | null
  city?: string | null
  contract_supply_amount?: number | string | null
  contract_supply_amount_words?: string | null
  house_kits_count?: number | null
  prepayment_amount?: number | string | null
  prepayment_words?: string | null
  balance_amount?: number | string | null
  balance_words?: string | null
  delivery_deadline?: string | null
  buyer_party_type?: 'individual' | 'legal' | null
  buyer_legal_json?: Record<string, string | null> | null
  created_on?: string | null
  modified_on?: string | null
}

export type ProjectContractDataUpdate = Partial<
  Pick<
    ProjectContractData,
    | 'contract_date'
    | 'city'
    | 'house_kits_count'
    | 'prepayment_amount'
    | 'prepayment_words'
    | 'balance_amount'
    | 'balance_words'
    | 'delivery_deadline'
    | 'buyer_party_type'
  >
>

export interface PrintSettings {
  id: number
  margin_top_mm: number
  margin_bottom_mm: number
  margin_left_mm: number
  margin_right_mm: number
  font_size_pt: number
  font_family: string
}

export interface PrintSettingsUpdate {
  margin_top_mm?: number
  margin_bottom_mm?: number
  margin_left_mm?: number
  margin_right_mm?: number
  font_size_pt?: number
  font_family?: string
}

export interface ProjectStatusLog {
  id: number
  project_id: number
  project_number?: string | null
  project_name?: string | null
  old_status_id?: number | null
  old_status_name?: string | null
  new_status_id?: number | null
  new_status_name?: string | null
  changed_at: string
}

export interface ConsolidatedKpRow {
  item_name: string
  quantity: number
  unit: string
  price: number
  sum_per_house: number
  house_count: number
  total_quantity: number
  total_sum: number
}

export interface ConsolidatedKpGroup {
  spec_numbers: string[]
  house_count: number
  rows: ConsolidatedKpRow[]
  group_total: number
}

export interface Specification {
  id: number
  number?: string | null  // человекочитаемый A00001-P01-S01
  customer_id: number
  project_id?: number | null
  status_id: number
  description?: string | null
  total_amount?: number | null
  kp_approved?: boolean | null
  /** Название в договоре */
  kp_internal_comment?: string | null
  /** Комментарий (отображается в списке спецификаций) */
  comment?: string | null
  /** Длина дома, м */
  length_m?: number | null
  /** Ширина дома, м */
  width_m?: number | null
  /** Длина террасы, м */
  terrace_length_m?: number | null
  /** Ширина террасы, м */
  terrace_width_m?: number | null
  /** Длина балкона, м */
  balcony_length_m?: number | null
  /** Терраса на втором этаже */
  terrace_second_floor?: boolean | null
  /** Этажность */
  floors?: number | null
  /** Количество комнат */
  room_count?: number | null
  /** Двойной брус */
  double_timber?: boolean | null
  /** Высота k для площади стен комнат, м */
  wall_height_m?: number | null
  /** Тип строения: Дом / Баня */
  building_type?: 'house' | 'banya' | null
  created_on?: string | null
  modified_on?: string | null
}

export type SpecificationCreate = Omit<Specification, 'id' | 'number' | 'created_on' | 'modified_on'>

export type SpecificationUpdate = Partial<
  Pick<
    Specification,
    | 'kp_approved'
    | 'kp_internal_comment'
    | 'comment'
    | 'description'
    | 'length_m'
    | 'width_m'
    | 'terrace_length_m'
    | 'terrace_width_m'
    | 'balcony_length_m'
    | 'terrace_second_floor'
    | 'floors'
    | 'room_count'
    | 'double_timber'
    | 'wall_height_m'
    | 'building_type'
  >
>

export interface Part {
  id: number
  name: string
  sort_order: number
}

export interface PartCreate {
  name: string
  sort_order?: number
}

export type PartUpdate = Partial<PartCreate>

export interface NomenclatureItem {
  id: number
  item_number: string
  name?: string | null
  part_id?: number | null
  item_date?: string | null
  unit: string
  unit_alt?: string | null
  total_cost: number
  price_alt?: number | null
  description?: string | null
}

export type NomenclatureItemCreate = Omit<NomenclatureItem, 'id' | 'item_number'> & { id?: never; item_number?: string | null }
export type NomenclatureItemUpdate = Partial<NomenclatureItemCreate>

export interface RequiredItemTemplate {
  id: number
  part_id: number
  name: string
  required_qty: number
  unit: string
}

export type RequiredItemTemplateCreate = Omit<RequiredItemTemplate, 'id'> & { id?: never }
export type RequiredItemTemplateUpdate = Partial<RequiredItemTemplateCreate>

export interface HouseSpecificationTemplate {
  id: number
  name: string
}

export type HouseSpecificationTemplateCreate = Omit<HouseSpecificationTemplate, 'id'> & { id?: never }
export type HouseSpecificationTemplateUpdate = Partial<HouseSpecificationTemplateCreate>

export interface HouseTemplate {
  id: number
  house_specification_template_id?: number | null
  part_id?: number | null
  required_item_template_id?: number | null
  nomenclature_item_id?: number | null
  unit: string
  quantity: number
  price?: number | null
  comment?: string | null
  /** fixed | perimeter | … | kit_area_plus_room_walls_area | wall_insulation_sds */
  qty_basis?: string | null
  qty_multiplier?: number | null
  qty_use_floors?: boolean | null
}

export type HouseTemplateCreate = Omit<HouseTemplate, 'id'> & { id?: never }
export type HouseTemplateUpdate = Partial<HouseTemplateCreate>

export interface RequiredItemMaterial {
  id: number
  required_item_template_id: number
  nomenclature_id: number
}

export type RequiredItemMaterialCreate = Omit<RequiredItemMaterial, 'id'> & { id?: never }

export type RequiredItemMaterialUpdate = Partial<
  Pick<RequiredItemMaterial, 'required_item_template_id' | 'nomenclature_id'>
>

export interface SpecificationItem {
  id: number
  specification_id: number
  item_name: string
  nomenclature_name?: string | null
  quantity?: number | null
  unit?: string | null
  price?: number | null
  discount_percent?: number | null
  total?: number | null
  description?: string | null
  part_id?: number | null
  template_id?: number | null
  nomenclature_item_id?: number | null
  qty_basis?: string | null
  qty_multiplier?: number | null
  qty_use_floors?: boolean | null
  quantity_auto?: number | null
  quantity_manual?: number | null
  /** № строки в шаблоне дома (1-based); для 19–22 — галочка «в сумме». */
  template_line_no?: number | null
  include_in_total?: boolean
}

export interface SpecificationItemCreate {
  specification_id: number
  part_id?: number | null
  template_id?: number | null
  nomenclature_item_id?: number | null
  item_name: string
  quantity?: number
  unit?: string
  price?: number
  discount_percent?: number
  total?: number
  description?: string | null
}

export type SpecificationItemUpdate = Partial<SpecificationItemCreate> & {
  quantity_manual?: number | null
  qty_basis?: string | null
  qty_multiplier?: number | null
  qty_use_floors?: boolean | null
  include_in_total?: boolean
  discount_percent?: number
}

export interface SpecificationItemAddBody {
  nomenclature_item_id?: number | null
  item_name?: string
  part_id?: number | null
  template_id?: number | null
  quantity?: number
  unit?: string
  price?: number
  discount_percent?: number
  description?: string | null
}

export interface SpecificationRequiredItem {
  id: number
  spec_id: number
  part_id: number
  template_id: number
  required_qty: number
  added_qty: number
}

export type SpecificationRequiredItemCreate = Omit<SpecificationRequiredItem, 'id'> & { id?: never }
export type SpecificationRequiredItemUpdate = Partial<SpecificationRequiredItemCreate>

export interface AuthUserOut {
  id: number
  nic: string
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  role_id?: number | null
  role_name?: string | null
  branch_id?: number | null
  parent_user_id?: number | null
  hierarchy_level?: number
  can_invite?: boolean
}

export interface InvitePreview {
  token: string
  target_hierarchy_level: number
  level_label: string
  inviter_name?: string | null
  parent_name?: string | null
  nic?: string | null
  email?: string | null
  first_name?: string | null
  last_name?: string | null
  expires_at: string
}

export interface InviteOut {
  id: number
  token: string
  invite_url: string
  target_hierarchy_level: number
  parent_user_id: number
  parent_name?: string | null
  nic?: string | null
  email?: string | null
  first_name?: string | null
  last_name?: string | null
  expires_at: string
  accepted_at?: string | null
}

export interface InviteCreate {
  target_hierarchy_level: 1 | 2
  parent_user_id?: number
  nic?: string
  email?: string
  first_name?: string
  last_name?: string
}

export interface TeamMemberOut {
  id: number
  nic: string
  first_name?: string | null
  last_name?: string | null
  hierarchy_level: number
  role_name?: string | null
  parent_user_id?: number | null
  direct_children_count: number
}

export interface ActivityEventTypeOut {
  code: string
  label: string
}

export interface AgentActivityOut {
  user_id: number
  name: string
  counts: Record<string, number>
  total: number
}

export interface TeamActivityOut {
  date: string
  event_types: ActivityEventTypeOut[]
  agents: AgentActivityOut[]
  team_totals: Record<string, number>
  agents_count: number
}

export interface ActivityDetailOut {
  id: number
  occurred_at: string
  event_type: string
  entity_type?: string | null
  entity_id?: number | null
  project_id?: number | null
  label: string
  project_number?: string | null
  project_name?: string | null
}

export interface TeamLimits {
  direct_children_count: number
  hierarchy_level: number
}

export interface RegisterInviteRequest {
  token: string
  nic?: string
  password: string
  first_name?: string
  last_name?: string
  email?: string
}

export interface RegisterByLinkRequest {
  ref: string
  nic?: string
  password: string
  first_name?: string
  last_name?: string
  email?: string
  challenge_id: string
  captcha_answer: number
}

export interface RegisterLinkPreview {
  ref: string
  manager_name: string
  level_label: string
}

export interface CaptchaChallenge {
  challenge_id: string
  question: string
}

export interface RegistrationLinkOut {
  has_link: boolean
  registration_key?: string | null
  enabled: boolean
  registration_url?: string | null
  registrations_count: number
  can_manage: boolean
}

export interface NotificationOut {
  id: number
  event_type: string
  title: string
  body?: string | null
  entity_type?: string | null
  entity_id?: number | null
  link_path?: string | null
  actor_user_id?: number | null
  actor_name?: string | null
  read_at?: string | null
  created_at: string
}

export interface ChatDialogOut {
  thread_id: number
  peer_user_id: number
  peer_name: string
  peer_nic: string
  unread_count: number
  last_message_body?: string | null
  last_message_at?: string | null
  last_message_is_system: boolean
}

export interface ChatAttachmentOut {
  id: number
  filename: string
  content_type: string
}

export interface ChatMessageOut {
  id: number
  thread_id: number
  sender_user_id?: number | null
  sender_name?: string | null
  body: string
  is_system: boolean
  meta?: Record<string, unknown> | null
  link_path?: string | null
  attachments?: ChatAttachmentOut[]
  created_at: string
}

export interface LoginResponse {
  access_token: string
  token_type: string
  user: AuthUserOut
}

export interface UserCreate {
  nic: string
  password: string
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  role_id?: number | null
  branch_id?: number | null
}

export interface UserUpdate {
  nic?: string | null
  password?: string | null
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  role_id?: number | null
  branch_id?: number | null
}

export interface UserRoleOut {
  id: number
  name: string
  description?: string | null
}

export interface SpecificationPhoto {
  id: number
  specification_id?: number | null
  house_specification_template_id?: number | null
  filename?: string | null
  sort_order: number
  created_on?: string | null
}
