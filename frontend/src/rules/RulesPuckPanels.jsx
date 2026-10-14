import { Drawer } from '@puckeditor/core'
import { STEP_CATEGORIES } from './ruleData.js'
import { stepKey } from './rulesConfig.jsx'

export function RulesDrawer({ rules, activeRuleId, onSelect }) {
  return (
    <div className="_ComponentList_1rrlt_1 _ComponentList--isExpanded_1rrlt_5">
      <button type="button" className="_ComponentList-title_1rrlt_17">
        <div>Правила</div>
        <div className="_ComponentList-titleIcon_1rrlt_53" />
      </button>
      <div className="_ComponentList-content_1rrlt_9">
        <div className="_Drawer_pl7z0_1">
          {rules.map((rule) => (
            <div key={rule.id} className="_DrawerItem_pl7z0_22 _DrawerItem--disabled_pl7z0_35">
              <button
                type="button"
                className="_DrawerItem-draggable_pl7z0_12"
                style={
                  rule.id === activeRuleId
                    ? { boxShadow: 'inset 0 0 0 2px var(--puck-color-azure-05)' }
                    : undefined
                }
                onClick={() => onSelect(rule.id)}
              >
                <div className="_DrawerItem-name_pl7z0_63">☑ {rule.name}</div>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function StepsLibrary() {
  return (
    <>
      {STEP_CATEGORIES.map((cat) => (
        <div key={cat.id} className="_ComponentList_1rrlt_1 _ComponentList--isExpanded_1rrlt_5">
          <button type="button" className="_ComponentList-title_1rrlt_17">
            <div>{cat.label}</div>
            <div className="_ComponentList-titleIcon_1rrlt_53" />
          </button>
          <div className="_ComponentList-content_1rrlt_9">
            <Drawer>
              {cat.steps.map((step, index) => {
                const key = stepKey(step.id)
                return (
                  <Drawer.Item
                    key={`${cat.id}-${key}-${index}`}
                    name={key}
                    label={step.label}
                    index={index}
                  />
                )
              })}
            </Drawer>
          </div>
        </div>
      ))}
    </>
  )
}
