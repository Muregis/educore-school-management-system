#!/usr/bin/env node
import fs from "fs";
const path = "src/pages/ReportsPage.jsx";
let t = fs.readFileSync(path, "utf8");

const oldClose = `          )}

        </div>
      )}
    </div>
  );
}

AnalysisTab.propTypes`;

const newClose = `          )}

        </div>
        </div>
      )}
    </div>
  );
}

AnalysisTab.propTypes`;

if (t.includes("ec-analysis-visual") && !t.includes(newClose.split("\n").slice(0,4).join("\n"))) {
  if (t.includes(oldClose)) {
    t = t.replace(oldClose, newClose);
    console.log("added missing visual wrapper close");
  } else if (t.includes("        </div>\n        </div>\n      )}\n    </div>\n  );\n}\n\nAnalysisTab.propTypes")) {
    console.log("wrapper already double-closed");
  } else {
    console.log("close pattern miss — searching...");
    const i = t.indexOf("AnalysisTab.propTypes");
    console.log(JSON.stringify(t.slice(i - 80, i)));
  }
}

const oldEr = `  if (data.streamAverages.length === 0) return (
    <Card style={{ textAlign: "center", padding: "60px var(--space-4)" }}>
      <EmptyState icon="📊" title="No results data yet" description="Enter results in the Grades page to see stream analysis." />
    </Card>
  );

  return (`;
if (t.includes(oldEr)) {
  t = t.replace(oldEr, `  // Keep filters visible even when a term has no rows yet
  return (`);
  console.log("removed empty early return");
}

const oldLoad = `  // Prevent rendering until data is loaded to avoid temporal dead zone errors
  if (loading || !data || !isInitialized) return (
    <Card style={{ textAlign: "center", padding: "60px var(--space-4)" }}>
      <EmptyState icon="📊" title="Loading analysis..." description="Please wait while we fetch the data." />
    </Card>
  );
`;
const newLoad = `  // First paint only — after that keep shell + filters mounted
  if (!data && (loading || !isInitialized)) return (
    <Card style={{ textAlign: "center", padding: "60px var(--space-4)" }}>
      <EmptyState icon="📊" title="Loading analysis..." description="Please wait while we fetch the data." />
    </Card>
  );
`;
if (t.includes(oldLoad)) {
  t = t.replace(oldLoad, newLoad);
  console.log("softened loading early return");
}

if (t.includes("}  }, [auth, term, className])")) {
  t = t.replace(/\}  \}, \[auth, term, className\]\);/g, "}, [auth, term, className]);");
  console.log("fixed double useCallback close");
}

fs.writeFileSync(path, t);
console.log("done");
