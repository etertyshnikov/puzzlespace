import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { AppChromeProvider } from './context/AppChromeContext'
import { Layout } from './components/Layout'
import { SettingsLayout } from './components/SettingsLayout'
import { Dashboard } from './pages/Dashboard'
import { DashboardGentelella } from './pages/DashboardGentelella'
import { Customers } from './pages/Customers'
import { CustomerForm } from './pages/CustomerForm'
import { Branches } from './pages/Branches'
import { LeadSources } from './pages/LeadSources'
import { SpecificationStatuses } from './pages/SpecificationStatuses'
import { SpecificationStatusForm } from './pages/SpecificationStatusForm'
import { ProjectStatuses } from './pages/ProjectStatuses'
import { ProjectStatusForm } from './pages/ProjectStatusForm'
import { ProjectSpecifications } from './pages/ProjectSpecifications'
import { ProjectStatusLogs } from './pages/ProjectStatusLogs'
import { Parts } from './pages/Parts'
import { PartForm } from './pages/PartForm'
import { NomenclatureItems } from './pages/NomenclatureItems'
import { NomenclatureItemForm } from './pages/NomenclatureItemForm'
import { RequiredItemTemplates } from './pages/RequiredItemTemplates'
import { RequiredItemTemplateForm } from './pages/RequiredItemTemplateForm'
import { HouseSpecificationTemplates } from './pages/HouseSpecificationTemplates'
import { HouseSpecificationTemplateForm } from './pages/HouseSpecificationTemplateForm'
import { HouseTemplates } from './pages/HouseTemplates'
import { HouseTemplateForm } from './pages/HouseTemplateForm'
import { RequiredItemMaterials } from './pages/RequiredItemMaterials'
import { RequiredItemMaterialForm } from './pages/RequiredItemMaterialForm'
import { SpecificationRequiredItems } from './pages/SpecificationRequiredItems'
import { SpecificationRequiredItemForm } from './pages/SpecificationRequiredItemForm'
import { BranchForm } from './pages/BranchForm'
import { LeadSourceForm } from './pages/LeadSourceForm'
import { Help } from './pages/Help'
import { KpTemplates } from './pages/KpTemplates'
import { KpTemplateEdit } from './pages/KpTemplateEdit'
import { Organizations } from './pages/Organizations'
import { OrganizationForm } from './pages/OrganizationForm'
import { Companies } from './pages/Companies'
import { CompanyForm } from './pages/CompanyForm'
import { ContractTemplates } from './pages/ContractTemplates'
import { ContractTemplateEdit } from './pages/ContractTemplateEdit'
import { PrintSettingsPage } from './pages/PrintSettingsPage'
import { QtyBasisRulesPage } from './pages/QtyBasisRulesPage'
import { Login } from './pages/Login'
import { Setup } from './pages/Setup'
import { RegisterInvite } from './pages/RegisterInvite'
import { Users } from './pages/Users'
import { UserForm } from './pages/UserForm'
import { Team } from './pages/Team'
import { Chat } from './pages/Chat'
import { MyAccountSettings } from './pages/MyAccountSettings'
import { SchemaSpyAdminGate } from './pages/SchemaSpyAdminGate'
import { DevToolsLayout } from './devtools/DevToolsLayout'
import { DevToolsRulesPage } from './pages/DevToolsRulesPage'
import { DevToolsRulesSandboxPage } from './pages/DevToolsRulesSandboxPage'
import { DevToolsFlowsPage } from './pages/DevToolsFlowsPage'
import { isAgentOnlyUser } from './utils/userRoles'
import { HomePage } from './public/HomePage'
import { AboutPage, ContactsPage, LegalPage, PartnerPage } from './public/InfoPages'
import { BoardPage } from './public/BoardPage'
import { CabinetPage, PortalAuthPage } from './public/CabinetPage'
import { ListingModeration } from './pages/ListingModeration'

const EstimateQuizPage = lazy(() => import('./public/estimate/EstimateQuizPage'))
const EstimatePublicPage = lazy(() => import('./public/estimate/EstimatePublicPage'))

function SettingsIndexRedirect() {
  const { user } = useAuth()
  if (isAgentOnlyUser(user)) {
    return <Navigate to="/settings/account" replace />
  }
  return <Navigate to="/settings/specification-statuses" replace />
}

function ProtectedRoute() {
  const { token, loading } = useAuth()
  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Загрузка…</div>
  if (!token) return <Navigate to="/login" replace />
  return <Outlet />
}

function AppFallbackRedirect() {
  const { pathname } = useLocation()
  if (pathname.startsWith('/settings')) {
    return <Navigate to="/settings/specification-statuses" replace />
  }
  return <Navigate to="/dashboard" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <AppChromeProvider>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contacts" element={<ContactsPage />} />
        <Route path="/estimate/:slug" element={<Suspense fallback={<div className="dom-root" style={{ padding: 32 }}>Открываем смету…</div>}><EstimatePublicPage /></Suspense>} />
        <Route path="/estimate" element={<Suspense fallback={<div className="dom-root" style={{ padding: 32 }}>Открываем калькулятор…</div>}><EstimateQuizPage /></Suspense>} />
        <Route path="/partner" element={<PartnerPage />} />
        <Route path="/cabinet" element={<CabinetPage />} />
        <Route path="/board/:kind" element={<BoardPage />} />
        <Route path="/order" element={<BoardPage kindOverride="order" />} />
        <Route path="/portal/login" element={<PortalAuthPage mode="login" />} />
        <Route path="/portal/register" element={<PortalAuthPage mode="register" />} />
        <Route path="/legal/privacy" element={<LegalPage doc="privacy" />} />
        <Route path="/legal/consent" element={<LegalPage doc="consent" />} />
        <Route path="/legal/terms" element={<LegalPage doc="terms" />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<RegisterInvite />} />
        <Route path="/setup" element={<Setup />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/devtools" element={<DevToolsLayout />}>
            <Route index element={<Navigate to="/devtools/rules" replace />} />
            <Route path="rules" element={<DevToolsRulesPage />} />
            <Route path="rules-sandbox" element={<DevToolsRulesSandboxPage />} />
            <Route path="flows" element={<DevToolsFlowsPage />} />
          </Route>
          <Route element={<Layout />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="moderation" element={<ListingModeration />} />
            <Route path="dashboard-gentelella" element={<DashboardGentelella />} />
            <Route path="customers" element={<Customers />} />
            <Route path="customers/new" element={<CustomerForm />} />
            <Route path="customers/:id/edit" element={<CustomerForm />} />
            <Route path="chat" element={<Chat />} />
            <Route path="projects/:projectId/specifications" element={<ProjectSpecifications />} />
            <Route path="help" element={<Help />} />
            <Route path="kp-preview" element={<Navigate to="/settings/kp-templates" replace />} />
            <Route path="settings/schemaspy" element={<SettingsLayout />}>
              <Route index element={<SchemaSpyAdminGate />} />
            </Route>
            <Route path="settings" element={<SettingsLayout />}>
              <Route index element={<SettingsIndexRedirect />} />
              <Route path="account" element={<MyAccountSettings />} />
              <Route path="specification-statuses" element={<SpecificationStatuses />} />
              <Route path="specification-statuses/new" element={<SpecificationStatusForm />} />
              <Route path="specification-statuses/:id/edit" element={<SpecificationStatusForm />} />
              <Route path="project-statuses" element={<ProjectStatuses />} />
              <Route path="project-statuses/new" element={<ProjectStatusForm />} />
              <Route path="project-statuses/:id/edit" element={<ProjectStatusForm />} />
              <Route path="status-logs" element={<ProjectStatusLogs />} />
              <Route path="branches" element={<Branches />} />
              <Route path="branches/new" element={<BranchForm />} />
              <Route path="branches/:id/edit" element={<BranchForm />} />
              <Route path="lead-sources" element={<LeadSources />} />
              <Route path="lead-sources/new" element={<LeadSourceForm />} />
              <Route path="lead-sources/:id/edit" element={<LeadSourceForm />} />
              <Route path="organizations" element={<Organizations />} />
              <Route path="organizations/new" element={<OrganizationForm />} />
              <Route path="organizations/:id/edit" element={<OrganizationForm />} />
              <Route path="companies" element={<Companies />} />
              <Route path="companies/new" element={<CompanyForm />} />
              <Route path="companies/:id/edit" element={<CompanyForm />} />
              <Route path="contract-templates" element={<ContractTemplates />} />
              <Route path="contract-templates/:id/edit" element={<ContractTemplateEdit />} />
              <Route path="kp-templates" element={<KpTemplates />} />
              <Route path="kp-templates/new" element={<KpTemplateEdit />} />
              <Route path="kp-templates/:id/edit" element={<KpTemplateEdit />} />
              <Route path="print-settings" element={<PrintSettingsPage />} />
              <Route path="parts" element={<Parts />} />
              <Route path="parts/new" element={<PartForm />} />
              <Route path="parts/:id/edit" element={<PartForm />} />
              <Route path="nomenclature-items" element={<NomenclatureItems />} />
              <Route path="nomenclature-items/new" element={<NomenclatureItemForm />} />
              <Route path="nomenclature-items/:id/edit" element={<NomenclatureItemForm />} />
              <Route path="required-item-templates" element={<RequiredItemTemplates />} />
              <Route path="required-item-templates/new" element={<RequiredItemTemplateForm />} />
              <Route path="required-item-templates/:id/edit" element={<RequiredItemTemplateForm />} />
              <Route path="house-specification-templates" element={<HouseSpecificationTemplates />} />
              <Route path="house-specification-templates/new" element={<HouseSpecificationTemplateForm />} />
              <Route path="house-specification-templates/:id/edit" element={<HouseSpecificationTemplateForm />} />
              <Route path="house-templates" element={<HouseTemplates />} />
              <Route path="house-templates/new" element={<HouseTemplateForm />} />
              <Route path="house-templates/:id/edit" element={<HouseTemplateForm />} />
              <Route path="qty-basis-rules" element={<QtyBasisRulesPage />} />
              <Route path="required-item-materials" element={<RequiredItemMaterials />} />
              <Route path="required-item-materials/new" element={<RequiredItemMaterialForm />} />
              <Route path="required-item-materials/:id/edit" element={<RequiredItemMaterialForm />} />
              <Route path="specification-required-items" element={<SpecificationRequiredItems />} />
              <Route path="specification-required-items/new" element={<SpecificationRequiredItemForm />} />
              <Route path="specification-required-items/:id/edit" element={<SpecificationRequiredItemForm />} />
              <Route path="team" element={<Team />} />
              <Route path="users" element={<Users />} />
              <Route path="users/new" element={<UserForm />} />
              <Route path="users/:id/edit" element={<UserForm />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<AppFallbackRedirect />} />
      </Routes>
      </AppChromeProvider>
    </AuthProvider>
  )
}
