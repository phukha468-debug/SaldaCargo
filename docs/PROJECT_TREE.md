.claude
  memory
      MEMORY.md
      project_moneymap_redesign.md
  settings.local.json
apps
  miniapp
      src
            app
                    (app)
                              dashboard
                                          page.tsx
                              maintenance
                                          page.tsx
                    api
                              assets
                                          route.ts
                              drivers
                                          route.ts
                              trips
                                          start
                                                        route.ts
                                          [id]
                    trip
                              new
                                          page.tsx
                              [id]
                    globals.css
                    layout.tsx
                    page.tsx
            components
                    features
                              ActiveTrip.tsx
                              DriverHome.tsx
                              OrderForm.tsx
            lib
                    hooks
                              useTrip.ts
                    supabase
                              admin.ts
                              client.ts
                              server.ts
      .env.local
      next-env.d.ts
      package.json
      postcss.config.js
      tailwind.config.ts
      tsconfig.json
  web
      src
            app
                    (dashboard)
                              employees
                                          page.tsx
                              finance
                                          page.tsx
                              fleet
                                          [id]
                                          page.tsx
                              integrations
                                          page.tsx
                              maintenance
                                          page.tsx
                              money-map
                                          page.tsx
                              payroll
                                          page.tsx
                              transactions
                                          page.tsx
                              trips
                                          page.tsx
                    api
                              assets
                                          [id]
                                          route.ts
                              auth
                                          logout
                                                        route.ts
                                          max
                                                        route.ts
                                          me
                                                        route.ts
                              debug-assets
                              fleet
                                          seed
                                                        route.ts
                                          stats
                                                        route.ts
                              health
                                          route.ts
                              money-map
                                          route.ts
                              payroll
                                          calculate
                                                        route.ts
                                          periods
                                                        route.ts
                              review
                                          [tripId]
                                          route.ts
                              setup
                                          seed
                                                        route.ts
                                          status
                                                        route.ts
                              transactions
                                          route.ts
                              trips
                                          summary
                                                        route.ts
                                          [id]
                                          route.ts
                    review
                              page.tsx
                    setup
                              layout.tsx
                              page.tsx
                    globals.css
                    layout.tsx
                    not-found.tsx
                    page.tsx
            components
                    dashboard
                              AlertsCard.tsx
                              MoneyMap.tsx
                              PnlCard.tsx
                              TodayCard.tsx
                              WalletCard.tsx
                    features
                              AssetGrid.tsx
                              MoneyMap.tsx
                              TripReviewTable.tsx
                    layout
                              MainLayout.tsx
                              TopNav.tsx
                    review
                              ReviewPage.tsx
                              TripReviewCard.tsx
                    setup
                              SetupWizard.tsx
                              Step1Legal.tsx
                              Step2Assets.tsx
                              Step3Users.tsx
                              Step4Balances.tsx
            lib
                    supabase
                              admin.ts
                              client.ts
                              server.ts
                    setup-data.ts
                    supabase-server.ts
            middleware.ts
      .env.local
      components.json
      next-env.d.ts
      next.config.ts
      package.json
      postcss.config.js
      tailwind.config.ts
      tsconfig.json
docs
  01_foundations
      MONOREPO_STRUCTURE.md
      SaldaCargo_Architecture_v2.3.md
  02_database
      DATABASE_MAP.md
      SaldaCargo_Seed_Data.md
  03_devops
      DEPLOYMENT_INSTRUCTIONS.md
      TASK_TEMPLATE.md
  04_planning
      ROADMAP.md
      W1_AUDIT_REPORT.md
  договор
      27e69723-58b3-4f36-b97f-4c26b0027011.jfif
      366726d0-83b4-4b7c-89b3-1db9fafb12d8.jfif
      73d2dec3-8c27-48d1-8ec4-df45f813e896.jfif
      99791c73-55a8-411a-a152-83ed06b894b2.jfif
      f1bda2f9-4df9-42aa-a304-c9c43e23b81a.jfif
      договор.docx
      договор.md
  Отчёты по работе
      19.04
            19.04.1.jfif
            19.04.2.jfif
      20.04
            20.04.1.jfif
            20.04.2.jfif
            20.04.3.jpg
      21.04
            21.04.1.jfif
            21.04.2.jfif
            21.04.3.jpg
      22.04
            22.04.1.jfif
            22.04.2.jfif
            22.04.3.jpg
      расходы
            расходы.xlsx
  BOOT.md
  BRIEF.md
  ENVIRONMENT.md
  impeccable.md
  LESSONS.md
  PROJECT_TREE.md
  RULES.md
handoff
  README.md
packages
  api-client
      src
            auth.ts
            supabase.ts
      package.json
  constants
      src
            index.ts
      package.json
  shared-types
      src
            api.types.ts
            database.types.ts
            index.ts
      package.json
  ui
      src
            components
                    badge.tsx
                    button.tsx
                    card.tsx
                    combobox.tsx
                    command.tsx
                    dialog.tsx
                    input.tsx
                    popover.tsx
                    select.tsx
                    skeleton.tsx
                    table.tsx
                    tabs.tsx
                    toaster.tsx
            lib
                    utils.ts
            index.ts
      package.json
      tailwind.config.ts
src
  components
      admin
            FleetGrid.tsx
            Integrations.tsx
            ShiftReview.tsx
            WebDashboard.tsx
      driver
            ActiveTrip.tsx
            DriverHome.tsx
            ExpenseForm.tsx
            OrderForm.tsx
            TripWizard.tsx
      Layout.tsx
  lib
      AuthContext.tsx
      firebase.ts
      utils.ts
  App.tsx
  index.css
  main.tsx
  types.ts
supabase
  schema.sql
tasks
  done
      001_init_monorepo.md
      002 docs fill .md
      002_verification.md
      003 supabase client.md
      004_setup_wizard.md
      005 money map.md
      006 miniapp driver.md
      007 review.md
      008_fleet-intelligence-system_task.md
      009_merge-fleet-sections_task.md
      010_seed-and-sync-core_task.md
  todo
.env.example
.env.local
firebase-applet-config.json
firebase-blueprint.json
firestore.rules
index.html
metadata.json
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
README.md
security_spec.md
seed.ts
tsconfig.base.json
tsconfig.json
vite.config.ts
