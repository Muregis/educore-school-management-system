#!/usr/bin/env node
import fs from "fs";
const path = "src/pages/ReportsPage.jsx";
let t = fs.readFileSync(path, "utf8");

// Broken ending of AnalysisTab visual block (missing </div> for ec-analysis-visual)
const broken = `        </div>
      )}
    </div>
  );
}

AnalysisTab.propTypes = { auth: PropTypes.object };`;

const fixed = `        </div>
        </div>
      )}
    </div>
  );
}

AnalysisTab.propTypes = { auth: PropTypes.object };`;

if (t.includes("ec-analysis-visual") && t.includes(broken)) {
  const idx = t.lastIndexOf(broken);
  t = t.slice(0, idx) + fixed + t.slice(idx + broken.length);
  fs.writeFileSync(path, t);
  console.log("inserted missing </div>");
} else if (t.includes(fixed.split("AnalysisTab")[0])) {
  console.log("already has double close before AnalysisTab");
} else {
  // alternate: if already fixed with two closing divs
  const alt = `        </div>
        </div>
      )}
    </div>
  );`;
  if (t.includes(alt)) {
    console.log("structure already fixed");
  } else {
    console.error("pattern not found");
    const i = t.indexOf("AnalysisTab.propTypes");
    console.error(JSON.stringify(t.slice(Math.max(0, i - 150), i)));
    process.exit(1);
  }
}

// Kill workflows that re-corrupt ReportsPage
for (const f of [
  ".github/workflows/apply-analysis-tab-harden.yml",
  ".github/workflows/fix-reports-callback-syntax.yml",
]) {
  if (fs.existsSync(f)) {
    fs.writeFileSync(
      f,
      "name: disabled\non:\n  workflow_dispatch:\njobs:\n  noop:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo disabled\n"
    );
    console.log("disabled", f);
  }
}
