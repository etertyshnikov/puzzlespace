export const PLACEHOLDERS = [
  { key: '{{organization_name}}', description: 'Название организации' },
  { key: '{{organization_inn}}', description: 'ИНН' },
  { key: '{{organization_kpp}}', description: 'КПП' },
  { key: '{{organization_address}}', description: 'Юридический адрес' },
  { key: '{{organization_bank}}', description: 'Наименование банка' },
  { key: '{{organization_bank_account}}', description: 'Расчётный счёт' },
  { key: '{{organization_bik}}', description: 'БИК банка' },
  { key: '{{organization_director_name}}', description: 'ФИО руководителя' },
  { key: '{{organization_director_position}}', description: 'Должность руководителя' },
] as const

/** Плейсхолдеры из «Данных для договора» и клиента по проекту (заполняются на странице спецификаций). */
export const CONTRACT_DATA_PLACEHOLDERS = [
  { key: '{{customer_full_name}}', description: 'ФИО клиента (заказчика по проекту)' },
  { key: '{{customer_organization_name}}', description: 'Наименование покупателя (ФИО или организация по типу договора)' },
  { key: '{{contract_date}}', description: 'Дата договора' },
  { key: '{{contract_date_long}}', description: 'Дата договора прописью (например: «01» января 2026 г.)' },
  { key: '{{city}}', description: 'Город (место заключения договора)' },
  { key: '{{contract_supply_amount}}', description: 'Сумма договора поставки в формате: 80 (восемьдесят рублей 00 копеек)' },
  { key: '{{house_kits_count}}', description: 'Количество домокомплектов (согласованных КП)' },
  { key: '{{house_size_mm}}', description: 'Размер дома в мм, например: 6000 х 7500 мм (длина и ширина из спецификации × 1000)' },
  { key: '{{house_type}}', description: 'Тип дома из спецификации: Дом или Баня' },
  { key: '{{house_type_genitive}}', description: 'Тип дома (род. падеж): дома или бани — для фраз вроде «поставка домокомплекта …»' },
  {
    key: '{{appendix_parts_table}}',
    description:
      'Строки <tr> для общей таблицы #appendix-tz-table (устаревший режим: все КП подряд). Не использовать вместе с {{appendix_specs_blocks}}',
  },
  {
    key: '{{appendix_specs_blocks}}',
    description:
      'Блоки по каждой согласованной КП: таблица ТЗ (размер, III/IV/V…, состав) + фото этой спецификации. Ставить после шапки с I–II',
  },
  {
    key: '{{appendix_photos}}',
    description:
      'Все фото согласованных КП в конце документа (только без {{appendix_specs_blocks}})',
  },
  {
    key: '{{appendix2_specs_content}}',
    description:
      'Приложение № 2: согласованные КП с заголовками; таблица позиций как в КП «Стандарт» (разделы с «Фундамента», № / номенклатура / ед. / кол-во / сумма)',
  },
  { key: '{{prepayment}}', description: 'Предоплата в формате: 50 (пятьдесят рублей 00 копеек)' },
  { key: '{{prepayment_amount}}', description: 'Предоплата — сумма цифрой' },
  { key: '{{prepayment_words}}', description: 'Предоплата прописью' },
  { key: '{{balance}}', description: 'Остаток в формате: 50 (пятьдесят рублей 00 копеек)' },
  { key: '{{balance_amount}}', description: 'Остаток — сумма цифрой' },
  { key: '{{balance_words}}', description: 'Остаток прописью' },
  { key: '{{delivery_deadline}}', description: 'Срок поставки (дата)' },
  { key: '{{delivery_deadline_long}}', description: 'Срок поставки прописью' },
] as const

/** Плейсхолдеры данных клиента: ФИО по частям, контакты, паспорт (заполняются из карточки клиента по проекту). */
export const CUSTOMER_PLACEHOLDERS = [
  { key: '{{customer_last_name}}', description: 'Фамилия клиента' },
  { key: '{{customer_name}}', description: 'Имя клиента' },
  { key: '{{customer_middle_name}}', description: 'Отчество клиента' },
  { key: '{{customer_address}}', description: 'Адрес клиента' },
  { key: '{{customer_phone}}', description: 'Телефон клиента' },
  { key: '{{customer_email}}', description: 'Email клиента' },
  { key: '{{customer_passport_series}}', description: 'Серия паспорта' },
  { key: '{{customer_passport_number}}', description: 'Номер паспорта' },
  { key: '{{customer_passport_issued_by}}', description: 'Кем выдан паспорт' },
  { key: '{{customer_passport_issue_date}}', description: 'Дата выдачи паспорта' },
  { key: '{{customer_passport_issue_date_long}}', description: 'Дата выдачи паспорта прописью' },
  { key: '{{customer_passport_department_code}}', description: 'Код подразделения паспорта' },
  { key: '{{customer_birth_date}}', description: 'Дата рождения' },
  { key: '{{customer_birth_date_long}}', description: 'Дата рождения прописью' },
  { key: '{{customer_birth_place}}', description: 'Место рождения' },
] as const

/** Плейсхолдеры юр. лица покупателя (вкладка «Клиент» → юр. лицо). */
export const CUSTOMER_LEGAL_PLACEHOLDERS = [
  { key: '{{customer_legal_company_name}}', description: 'Наименование организации покупателя' },
  { key: '{{customer_legal_inn}}', description: 'ИНН покупателя' },
  { key: '{{customer_legal_kpp}}', description: 'КПП покупателя' },
  { key: '{{customer_legal_ogrn}}', description: 'ОГРН покупателя' },
  { key: '{{customer_legal_company_address}}', description: 'Юридический адрес покупателя' },
  { key: '{{customer_legal_bank}}', description: 'Банк покупателя' },
  { key: '{{customer_legal_bank_account}}', description: 'Расчётный счёт покупателя' },
  { key: '{{customer_legal_bik}}', description: 'БИК банка покупателя' },
  { key: '{{customer_legal_signatory_name}}', description: 'ФИО подписанта покупателя' },
  { key: '{{customer_legal_signatory_basis}}', description: 'Основание полномочий подписанта' },
] as const

export const ALL_CONTRACT_PLACEHOLDER_GROUPS = [
  { title: 'Организация', items: PLACEHOLDERS },
  { title: 'Данные для договора', items: CONTRACT_DATA_PLACEHOLDERS },
  { title: 'Данные клиента', items: CUSTOMER_PLACEHOLDERS },
  { title: 'Юр. лицо покупателя', items: CUSTOMER_LEGAL_PLACEHOLDERS },
] as const

export function Help() {
  return (
    <div>
      <div className="page-title">
        <h2>Помощь</h2>
      </div>
      <div className="x_panel">
        <div className="x_title">
          <h3>Стейкхолдеры в шаблонах договоров</h3>
        </div>
        <div className="x_content" style={{ padding: '16px 20px' }}>
          <p style={{ marginBottom: 16 }}>
            В шаблонах договоров (Настройки → Договора) можно использовать подстановки — стейкхолдеры.
            При формировании договора по проекту они заменяются данными выбранной организации.
          </p>
          <table className="table table-bordered" style={{ maxWidth: 560 }}>
            <thead>
              <tr>
                <th>Подстановка</th>
                <th>Описание</th>
              </tr>
            </thead>
            <tbody>
              {PLACEHOLDERS.map(({ key, description }) => (
                <tr key={key}>
                  <td><code style={{ whiteSpace: 'nowrap' }}>{key}</code></td>
                  <td>{description}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h4 style={{ marginTop: 24, marginBottom: 12 }}>Данные для договора (по проекту)</h4>
          <p style={{ marginBottom: 12, fontSize: 13 }}>
            Подставляются из блока «Данные для договора» на странице спецификаций проекта. Предоплата и остаток можно вывести в формате «50 (пятьдесят рублей 00 копеек)» — плейсхолдеры <code>{'{{prepayment}}'}</code> и <code>{'{{balance}}'}</code>.
          </p>
          <table className="table table-bordered" style={{ maxWidth: 560 }}>
            <thead>
              <tr>
                <th>Подстановка</th>
                <th>Описание</th>
              </tr>
            </thead>
            <tbody>
              {CONTRACT_DATA_PLACEHOLDERS.map(({ key, description }) => (
                <tr key={key}>
                  <td><code style={{ whiteSpace: 'nowrap' }}>{key}</code></td>
                  <td>{description}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h4 style={{ marginTop: 24, marginBottom: 12 }}>Данные клиента (паспорт, контакты, юр. лицо)</h4>
          <p style={{ marginBottom: 12, fontSize: 13 }}>
            Подставляются из карточки клиента по проекту (кнопка «Данные для договора» → вкладка «Клиент»). Даты выводятся в формате ДД.ММ.ГГГГ.
          </p>
          <table className="table table-bordered" style={{ maxWidth: 560 }}>
            <thead>
              <tr>
                <th>Подстановка</th>
                <th>Описание</th>
              </tr>
            </thead>
            <tbody>
              {CUSTOMER_PLACEHOLDERS.map(({ key, description }) => (
                <tr key={key}>
                  <td><code style={{ whiteSpace: 'nowrap' }}>{key}</code></td>
                  <td>{description}</td>
                </tr>
              ))}
              {CUSTOMER_LEGAL_PLACEHOLDERS.map(({ key, description }) => (
                <tr key={key}>
                  <td><code style={{ whiteSpace: 'nowrap' }}>{key}</code></td>
                  <td>{description}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ marginTop: 16, color: '#73879C', fontSize: 13 }}>
            Вставьте нужный стейкхолдер в текст шаблона (кнопки «Вставить» на странице редактирования договора).
          </p>
        </div>
      </div>
    </div>
  )
}
