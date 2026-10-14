import createCustomer from './customers/create-customer.json'
import editCustomer from './customers/edit-customer.json'
import listAndProjects from './customers/list-and-projects.json'
import transferCustomer from './customers/transfer-customer.json'
import backofficeOverview from './backoffice/backoffice-overview.json'
import createCompany from './backoffice/create-company.json'
import addCompanyUser from './companies/add-company-user.json'

export const FLOW_GROUPS = [
  {
    id: 'customers',
    label: 'Клиенты (smetadoma05)',
    flows: [createCustomer, editCustomer, listAndProjects, transferCustomer],
  },
  {
    id: 'backoffice',
    label: 'Управление приложением (backoffice)',
    flows: [backofficeOverview, createCompany],
  },
  {
    id: 'companies',
    label: 'Компании — ЛК (Go v2)',
    flows: [addCompanyUser],
  },
]

export const ALL_FLOWS = FLOW_GROUPS.flatMap((g) => g.flows)

export function getFlowById(id) {
  return ALL_FLOWS.find((f) => f.id === id) ?? null
}
