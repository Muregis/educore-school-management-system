import os
import re

fp = 'src/pages/TermManagementPage.jsx'
with open(fp, 'r', encoding='utf-8') as f:
    content = f.read()

if 'import EmptyState from' not in content:
    content = content.replace('import Button from "../components/ui/Button";', 'import Button from "../components/ui/Button";\nimport EmptyState from "../components/ui/EmptyState";')

# Find the Table render block
table_block = '''        <div style={{ overflowX: "auto" }}>
          <Table
              headers={["Term", "Year", "Start", "End", "Status", "Actions"]}
              data={terms.map(term => ['''

new_table_block = '''        {terms.length === 0 ? (
          <EmptyState
            icon="📅"
            title="No Terms Configured"
            description="There are no academic terms in the system yet."
            actionLabel="Create First Term"
            onAction={() => setShowCreateModal(true)}
          />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <Table
                headers={["Term", "Year", "Start", "End", "Status", "Actions"]}
                data={terms.map(term => ['''

content = content.replace(table_block, new_table_block)

# Close the ternary operator after Table
table_end = '''                  </Button>
                  </div>
              ])}
          />
        </div>
      </Card>'''

new_table_end = '''                  </Button>
                  </div>
              ])}
            />
          </div>
        )}
      </Card>'''
content = content.replace(table_end, new_table_end)

with open(fp, 'w', encoding='utf-8') as f:
    f.write(content)
print("Added EmptyState")
