#!/usr/bin/env node
import fs from "fs";
const path = "src/pages/ReportsPage.jsx";
let t = fs.readFileSync(path, "utf8");
const bad = "  }  }, [auth, term, className]);";
const good = "  }, [auth, term, className]);";
if (!t.includes(bad)) {
  // try variants
  const bad2 = "}  }, [auth, term, className]);";
  if (t.includes(bad2)) {
    t = t.replace(bad2, "}, [auth, term, className]);");
    console.log("fixed variant2");
  } else if (t.includes("}  }, [auth")) {
    t = t.replace(/\}  \}, \[auth, term, className\]\);/, "}, [auth, term, className]);");
    console.log("fixed regex");
  } else {
    console.log("pattern not found — already fixed?");
    console.log(t.includes("}, [auth, term, className]);"));
  }
} else {
  t = t.replace(bad, good);
  console.log("fixed exact");
}
fs.writeFileSync(path, t);
if (t.includes("}  }, [auth")) {
  console.error("STILL BROKEN");
  process.exit(1);
}
console.log("OK");
