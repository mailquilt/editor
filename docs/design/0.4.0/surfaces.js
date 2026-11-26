// 0.4.0 surfaces: the frames the concept didn't draw. Loaded after the concept's
// script, before every frame gets its dark twin.
document.querySelector("svg").insertAdjacentHTML("beforeend", `
  <symbol id="sliders" viewBox="0 0 24 24"><path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/></symbol>
  <symbol id="menu" viewBox="0 0 24 24"><rect x="2.5" y="7.5" width="19" height="9" rx="2"/><path d="M6.5 12h2.5M10.8 12h2.5M15 12h2.5"/></symbol>
  <symbol id="video" viewBox="0 0 24 24"><rect x="2.5" y="4.5" width="19" height="15" rx="2.5"/><path d="m10 9 5 3-5 3z"/></symbol>
  <symbol id="play" viewBox="0 0 24 24"><path d="M6 4v16l14-8z"/></symbol>
  <symbol id="send" viewBox="0 0 24 24"><path d="M21 3 10 14M21 3l-6.5 18-4.5-7-7-4.5z"/></symbol>
  <symbol id="code" viewBox="0 0 24 24"><path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/></symbol>
  <symbol id="lines" viewBox="0 0 24 24"><path d="M4 6h16M4 10h16M4 14h10M4 18h12"/></symbol>
  <symbol id="vt" viewBox="0 0 24 24"><path d="M4 4h16"/><rect x="8" y="7" width="8" height="9" rx="1.5"/></symbol>
  <symbol id="vm" viewBox="0 0 24 24"><path d="M3 12h4M17 12h4"/><rect x="8" y="7" width="8" height="10" rx="1.5"/></symbol>
  <symbol id="vb" viewBox="0 0 24 24"><path d="M4 20h16"/><rect x="8" y="8" width="8" height="9" rx="1.5"/></symbol>
  <symbol id="col" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 3v18"/></symbol>
  <symbol id="keys" viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8"/></symbol>
  <symbol id="import" viewBox="0 0 24 24"><path d="M12 3v12M7 10l5 5 5-5M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/></symbol>
  <symbol id="file" viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></symbol>
  <symbol id="info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></symbol>
  <symbol id="desktoponly" viewBox="0 0 24 24"><rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></symbol>
`);

const AFTER = []; window.afterRails = () => AFTER.forEach((f) => f());
const G = [];
const PASSED = ["Every Image has an image", "Preheader is set", "Every Merge Tag will be filled in", "41 KB, under Gmail’s 102 KB cut-off", "Language is set", "Text is easy to read", "Every link says where it goes", "There’s an unsubscribe link"];
const PASSED_ALL = ["Every Image has alt text", "Every Button and link goes somewhere", ...PASSED];
const passedSec = (list, top) => `<div class="sec"${top ? ' style="border-top:1px solid var(--line)"' : ""}><h3>Passed<span>${list.length}</span></h3><div class="passed">${list.map((x) => `<div>${ic("check", "sm")}${x}</div>`).join("")}</div><div style="height:12px"></div></div>`; // [frame id prefix, title, job]
const group = (id, title, job) => G.push([id, title, job]);
const app = (o) => `<div class="app ${o.layout || "rail"}${o.msg ? " msg" : ""}">${o.top || topBar({ mode: o.mode || "edit" })}${o.left === undefined ? rail(o.sel || 0) : o.left}<main class="cv"${o.cvStyle ? ` style="${o.cvStyle}"` : ""}>${o.ctx || ""}${o.extra || ""}<div class="stage"${o.stage ? ` style="${o.stage}"` : ""}>${o.email}</div>${o.over || ""}</main>${o.right || ""}</div>`;
const tail = `<span class="ib">${ic("up")}</span><span class="ib">${ic("down")}</span><span class="ib">${ic("dup")}</span><span class="ib">${ic("trash")}</span>`;
const moreBtn = (on) => `<span class="ib${on ? " on" : ""}">${ic("more")}</span>`;
const chip = (icon, path, name) => `<span class="chip"><span class="ico">${ic(icon)}</span>${path ? `<span class="path">${path} /</span>` : ""}${name}<span class="chev">${ic("chev", "sm")}</span></span><span class="vr"></span>`;
const segA = (on = "l") => `<span class="seg"><span class="ib${on === "l" ? " on" : ""}">${ic("al", "sm")}</span><span class="ib${on === "c" ? " on" : ""}">${ic("ac", "sm")}</span><span class="ib${on === "r" ? " on" : ""}">${ic("ar", "sm")}</span></span>`;
const BLOCKS = [["text", "Text"], ["head", "Heading"], ["img", "Image"], ["button", "Button"], ["divider", "Divider"], ["spacer", "Spacer"], ["social", "Social"], ["menu", "Menu"], ["video", "Video"]];
const bgrid = (f) => `<div class="bgrid">${BLOCKS.map(([k, n], i) => `<span class="bt${i === f ? " f" : ""}">${ic(k)}${n}</span>`).join("")}</div>`;
const LAYOUTS = [[1], [1, 1], [1, 2], [2, 1], [1, 1, 1], [1, 1, 1, 1]];
const lgrid = (f) => `<div class="lgrid">${LAYOUTS.map((w, i) => `<span class="lt${i === f ? " f" : ""}">${w.map((x) => `<b style="flex:${x}"></b>`).join("")}</span>`).join("")}</div>`;
const savedRows = `<div class="rgrid">
  <div class="rt"><div class="mini"><div class="sc" data-clone="2,3"></div></div><b>Hero with button</b></div>
  <div class="rt"><div class="mini"><div class="sc" data-clone="4"></div></div><b>Two products</b></div>
  <div class="rt"><div class="mini"><div class="sc" data-clone="5"></div></div><b>Quote</b></div>
  <div class="rt"><div class="mini"><div class="sc" data-clone="6"></div></div><b>Footer</b></div></div>`;

// ---------- 1. Top bar and the Modes ----------
group("t0", "Top bar and the three Modes", "Where am I, is it saved, and how do I get out. The Shell adds the name, the save status and Export; the element alone keeps undo, redo, the Modes and Desktop/Phone.");
F.push({ id: "t01-saving", html: () => app({ ctx: ctxButton, sel: 3, top: topBar({ mode: "edit" }).replace('<span class="st">Saved</span>', '<span class="st">Saving…</span>'), email: email({ sel: "btn" }) }) });
const elementTop = (focusMode) => topBar({ mode: "edit" })
  .replace(/<div class="doc">[\s\S]*?<\/div>\s*<span class="vr"><\/span>/, "")
  .replace(/<span class="ib">\s*<svg class="i "><use href="#more"\/><\/svg><\/span>\s*<span class="btn pri[^"]*">[\s\S]*?Export<\/span>/, "")
  .replace(`<span class="" style="">${ic("palette", "sm")}Style</span>`, `<span class="${focusMode ? "focus" : ""}" style="">${ic("palette", "sm")}Style</span>`);
F.push({ id: "t02-element-only", html: () => app({ ctx: ctxButton, sel: 3, top: elementTop(true), email: email({ sel: "btn" }), over: `<div class="tip" style="left:473px;top:6px;transform:translateX(-50%)">Style<kbd>← → to move between Modes</kbd></div>` }) });
F.push({ id: "t03-export-menu", html: () => app({ ctx: ctxButton, sel: 3, email: email({ sel: "btn" }), top: topBar({ mode: "edit" }).replace(/(<span class="btn pri[^"]*">)([\s\S]*?Export)(<\/span>)/, `<span class="anc">$1$2${ic("chev", "sm")}$3<div class="pop menu" style="right:0;top:38px;width:260px">
    <div class="mi on" style="height:auto;padding:8px;align-items:start">${ic("file", "sm")}<span><span style="display:block">HTML file</span><span style="color:var(--text-3);font-size:12px">The email, ready to send</span></span><kbd></kbd></div>
    <div class="mi" style="height:auto;padding:8px;align-items:start">${ic("file", "sm")}<span><span style="display:block">JSON file</span><span style="color:var(--text-3);font-size:12px">To open in Mail Quilt again</span></span><kbd></kbd></div>
  </div></span>`) }) });
F.push({ id: "t04-more-menu", html: () => app({ ctx: ctxButton, sel: 3, email: email({ sel: "btn" }), top: topBar({ mode: "edit" }).replace(/<span class="ib">(\s*<svg class="i "><use href="#more"\/><\/svg>)<\/span>(\s*<span class="btn pri)/, `<span class="anc"><span class="ib on">$1</span><div class="pop menu" style="right:0;top:38px;width:230px">
    <div class="mi">${ic("import", "sm")}Import JSON…<kbd></kbd></div>
    <div class="mi">${ic("keys", "sm")}Keyboard shortcuts<kbd>?</kbd></div>
  </div></span>$2`) }) });
F.push({ id: "t05-view-menu", html: () => app({ sel: 0, ctx: ctxNone, stage: "margin-top:-760px", email: email({}).replace(ROW5, `<div class="hidstrip">${ic("phone", "sm")}Row 5 · Phones only</div>`), top: topBar({ mode: "edit" }).replace(/<span class="ib">(\s*<svg class="i "><use href="#more"\/><\/svg>)<\/span>(\s*<span class="btn pri)/, `<span class="anc"><span class="ib on">$1</span><div class="pop menu" style="right:0;top:38px;width:290px;white-space:normal">
    <div class="hd"><span>Not on this device</span></div>
    ${[["Fold", "A thin strip you can still select"], ["Fade", "Full size, faded, with a tag"], ["Hide", "Not drawn. The Rows list still marks it."]].map(([n, d], i) => `<div class="mi${i === 0 ? " on" : ""}" style="height:auto;padding:7px 8px;align-items:start">${i === 0 ? ic("check", "sm") : "<span></span>"}<span><span style="display:block">${n}</span><span style="color:var(--text-3);font-size:12px">${d}</span></span><kbd></kbd></div>`).join("")}
    <div class="msep"></div>
    <div class="mi">${ic("import", "sm")}Import JSON…<kbd></kbd></div>
    <div class="mi">${ic("keys", "sm")}Keyboard shortcuts<kbd>?</kbd></div>
  </div></span>$2`) }) });

// ---------- 2. Rows list ----------
group("l0", "Rows list", "The email's structure at a glance: jump to a Row, drag or Alt+↑/↓ to reorder, + to add one with a layout or a Saved Row.");
F.push({ id: "l01-hover-drag", html: () => app({ left: rail(0, { ins: 2 }).replace('data-sel="0"', 'data-sel="0" data-lift="4" data-grip="3"').replace(/<\/aside>$/, `<div class="liftthumb" data-lift-ghost="4"><div class="sc" data-clone="4"></div></div></aside>`), email: email({}) }) });
F.push({ id: "l02-keyboard-move", html: () => app({ stage: "margin-top:-280px", left: rail(3).replace('data-sel="3"', 'data-sel="3" data-kfocus="3"'), ctx: ctxRow.replace(">Row 4<", ">Row 3<"), email: email({ row: 3 }), over: `<div class="tip" style="left:-20px;top:300px;position:fixed" data-tipfor="3">Row 3 of 6<kbd>Alt+↑ or Alt+↓ to move</kbd></div>` }) });
const addRowPop = (saved) => `<div class="pop addrow">
  <h6>Empty Row</h6>${lgrid(1)}
  ${saved ? `<h6>Saved Rows<span>4</span></h6>${savedRows}` : ""}
  <div class="foot">Adds below Row 4</div></div>`;
F.push({ id: "l03-add-row", html: () => app({ left: rail(4).replace('<span class="ib">' + ic("plus") + "</span>", '<span class="ib on">' + ic("plus") + "</span>") + addRowPop(true), ctx: ctxRow, stage: "margin-top:-330px", email: email({ row: 4 }) }).replace('<div class="app rail">', '<div class="app rail" style="position:relative">') });
F.push({ id: "l04-add-row-no-saved", html: () => app({ left: rail(4).replace('<span class="ib">' + ic("plus") + "</span>", '<span class="ib on">' + ic("plus") + "</span>") + addRowPop(false), ctx: ctxRow, stage: "margin-top:-330px", email: email({ row: 4 }) }).replace('<div class="app rail">', '<div class="app rail" style="position:relative">') });
F.push({ id: "l05-empty-email", html: () => app({ left: `<aside class="rail-p"><div class="rail-h"><b>Rows<span>0</span></b><span class="ib">${ic("plus")}</span></div><div class="emptyrail"><b>No Rows yet</b>Add one here or on the email.</div></aside>`, ctx: ctxNone.replace(/<span class="hint">[\s\S]*?<span class="vr"><\/span>/, ""), top: topBar({ mode: "edit", fresh: true }), email: `<div class="em blank"><div class="slotrow"><b>Start with a Row</b>Pick how many Columns it has. You can change it after.<div class="lts">${LAYOUTS.map((w) => `<span>${w.map((x) => `<b style="flex:${x}"></b>`).join("")}</span>`).join("")}</div></div></div>` }) });

// ---------- 3. Selection bar and More ----------
group("b0", "Selection bar: More", "Settings that don't fit the bar, the fuller settings and the less common actions, one press away. Picked: a docked drawer where the email fits beside it (b02, b04), a floating panel below that (b05), a sheet on phones. The other frames show why.");
const calloutText = (s, m) => email(s, m).replace('style="margin:0 -12px 22px; padding:4px 12px"', 'style="margin:0 0 22px; padding:16px 20px; background:#efe6da; border-radius:8px"');
const morePanel = (cls, style = "") => `<div class="${cls}"${style ? ` style="${style}"` : ""}>
  <div class="mp-h"><div><b>Text</b><small>Row 3, Column 1</small></div><span class="ib">${ic("x")}</span></div>
  <div class="mp-s"><h5>Box</h5>
    <div class="pr"><span>Padding</span><span class="v"><span class="num">${ic("pad", "sm")}16 · 20<span class="u">px</span>${ic("chev", "sm")}</span></span></div>
    <div class="pr"><span>Background</span><span class="v"><span class="swf"><span class="sw" style="background:#efe6da"></span>#EFE6DA</span></span></div>
    <div class="pr"><span>Border</span><span class="v"><span class="swf dimtxt">None${ic("chev", "sm")}</span></span></div>
    <div class="pr"><span>Corners</span><span class="v"><span class="num">8<span class="u">px</span></span></span></div>
    <div class="note">${ic("info", "sm")}Outlook on Windows shows square corners.</div>
  </div>
  <div class="mp-s"><h5>Show on</h5><div class="seg t"><span class="on">All devices</span><span>Desktop only</span><span>Phones only</span></div></div>
  <div class="mp-s"><h5>Actions</h5>
    <div class="mi">${ic("dup", "sm")}Copy<kbd>⌘C</kbd></div>
    <div class="mi">${ic("cut", "sm")}Cut<kbd>⌘X</kbd></div>
    <div class="mi">${ic("down", "sm")}Paste below<kbd>⌘V</kbd></div>
    <div class="mi dim" title="It's in the only Column">${ic("right", "sm")}Move to the next Column<kbd>⌥→</kbd></div>
    <div class="mi">${ic("rows", "sm")}Select Row 3<kbd></kbd></div>
  </div></div>`;
const ctxTextMore = ctxText.replace('<span class="ib on">' + ic("braces") + "</span>", '<span class="ib">' + ic("braces") + "</span>").replace(/<span class="ib">(\s*)?<svg class="i "><use href="#more"\/><\/svg><\/span>\s*<\/div>$/, `<span class="ib on">${ic("more")}</span></div>`);
F.push({ id: "b01-more-panel", html: () => app({ ctx: ctxTextMore, sel: 3, email: calloutText({ sel: "p", grip: true }), over: morePanel("morep") + `<div class="tip" style="right:330px;top:531px">It's in the only Column</div>` }) });
F.push({ id: "b02-more-drawer", html: () => app({ layout: "rail drawerapp", ctx: ctxTextMore, sel: 3, email: calloutText({ sel: "p", grip: true }), right: morePanel("drawer") }).replace('<div class="app rail drawerapp">', '<div class="app rail drawerapp" style="grid-template-columns:232px 1fr 320px">') });

// ---------- 4. Adding a Block from the Canvas ----------
group("a0", "Adding a Block from the Canvas", "Add where you're looking: the + between Blocks, the empty Column's control, or / for the Add panel.");
const insAt = (inner) => (s) => email(s).replace('<div class="b" style="margin:0 -12px 30px; padding:6px 12px">', `<div class="insl"><i></i>${inner}</div><div class="b" style="margin:0 -12px 30px; padding:6px 12px">`);
F.push({ id: "a01-insert-hover", html: () => app({ ctx: ctxNone, email: insAt(`<b>${ic("plus", "sm")}</b><span class="tip">Add a Block here</span>`)({}) }) });
F.push({ id: "a02-insert-picker", html: () => app({ ctx: ctxNone, email: insAt(`<b>${ic("plus", "sm")}</b><div class="pop ipick"><div class="search">${ic("search", "sm")}<span>Search Blocks</span></div>${bgrid(0)}<div class="foot">Adds below the Text, in Row 3</div></div>`)({}) }) });
F.push({ id: "a03-insert-no-match", html: () => app({ ctx: ctxNone, email: insAt(`<b>${ic("plus", "sm")}</b><div class="pop ipick"><div class="search">${ic("search", "sm")}<span class="typed">tabel</span><span class="caret" style="background:var(--text);height:15px"></span></div><div class="nomatch"><b>No Block called “tabel”</b>Try Text, Image or Button.</div></div>`)({}) }) });

// ---------- 5. Style ----------
group("s0", "Style: pickers and their states", "Set the shared look and see it change. A value not set shows the built-in default; fonts come from the system and the host's list.");
const styleWith = (patch) => styleSide().replace(...patch);
const colorPop = `<div class="pop colorpop" style="right:360px;top:200px">
  <div class="sat"><i></i></div><div class="hue"><i></i></div>
  <div class="row-flex" style="gap:6px"><span class="fld" style="flex:1"><span class="lab">Hex</span>#2B1D14</span></div>
  <div class="lbl">In this email</div><div class="swrow">${["#2b1d14", "#4a3a2e", "#b5652b", "#efe6da", "#fbf7f1", "#7a6a5d"].map((c) => `<span class="sw" style="background:${c}"></span>`).join("")}</div>
  <div class="def">${ic("x", "sm")}Use the default (#2563EB)</div></div>`;
F.push({ id: "s03-color-picker", html: () => `<div class="app panel">${topBar({ mode: "style" })}<main class="cv"><div class="stage" style="padding-top:40px">${email({ hov: ["btn"], htag: ["btn", "Buttons · #2B1D14"] })}</div></main>${styleSide()
  .replace('<div class="kv"><span>Buttons</span><span class="v">', '<div class="kv" style="background:var(--accent-soft);margin:0 -10px 2px;padding:0 10px;border-radius:var(--r-ctl)"><span>Buttons</span><span class="v">')
  .replace('<span class="hex">#B5652B</span><span class="sw" style="background:#b5652b"></span>', '<span class="tagd">Default</span><span class="hex def">Same as text</span><span class="sw" style="background:#2b1d14;opacity:.45"></span>')
  .replace('<aside class="side" style="overflow:hidden">', '<aside class="side" style="overflow:visible;position:relative">' + colorPop)}</div>` });
const fontPop = (state) => `<div class="pop fontpop" style="right:16px;top:388px">
  <div class="search" style="margin:2px 2px 4px">${ic("search", "sm")}<span>Search fonts</span></div>
  <div class="grp">Your fonts</div>
  <div class="fo"><span><span class="nm" style="font-family:Fraunces, Georgia, serif">Fraunces</span><small>Falls back to Georgia</small></span>${state === "loading" ? `<span class="spin d"></span>` : ""}</div>
  <div class="fo k"><span><span class="nm" style="font-family:'DM Serif Display', Georgia, serif">DM Serif Display</span><small>Falls back to Georgia</small></span></div>
  <div class="fo"><span><span class="nm" style="font-family:Inter, Arial, sans-serif">Inter</span><small>Falls back to Arial</small></span></div>
  <div class="grp">System fonts</div>
  <div class="fo"><span class="nm" style="font-family:Arial">Arial</span></div>
  <div class="fo on"><span class="nm" style="font-family:Georgia">Georgia</span>${ic("check", "sm")}</div>
  <div class="fo"><span class="nm" style="font-family:Tahoma">Tahoma</span></div>
  <div class="fo"><span class="nm" style="font-family:'Times New Roman'">Times New Roman</span></div>
</div>`;
F.push({ id: "s04-font-picker", html: () => `<div class="app panel">${topBar({ mode: "style" })}<main class="cv"><div class="stage" style="padding-top:40px">${email({ hov: ["h1"], htag: ["h1", "Headings · Georgia"] })}</div></main>${styleSide()
  .replace('<span class="v fld" style="height:30px">Georgia', '<span class="v fld foc" style="height:30px">Georgia')
  .replace('<aside class="side" style="overflow:hidden">', '<aside class="side" style="overflow:visible;position:relative">' + fontPop("loading"))}</div>` });
F.push({ id: "s05-font-failed", html: () => `<div class="app panel">${topBar({ mode: "style" })}<main class="cv"><div class="stage" style="padding-top:40px">${email({})}</div></main>${styleSide()
  .replace('<span class="v fld" style="height:30px">Georgia' + ic("chev", "sm") + "</span></div>", `<span class="v fld" style="height:30px;box-shadow:inset 0 0 0 1px var(--warn)">${ic("alert", "sm")}Fraunces${ic("chev", "sm")}</span></div><div class="fldnote w">Fraunces couldn’t be loaded, so you see Georgia, its fallback. Readers may see Georgia too.</div>`)
  .replace('<span class="v fld" style="height:30px">Arial' + ic("chev", "sm"), `<span class="v fld" style="height:30px"><span class="spin d"></span>Inter${ic("chev", "sm")}`)
  .replace('<div class="typ on"', '<div class="fldnote m" style="margin-top:-4px">Loading Inter…</div><div class="typ"')}</div>` });

// ---------- 6. Check ----------
group("c0", "Check: tabs, many Problems, sending a test", "See it as readers will, read the plain text and the HTML, fix what's wrong, and send a test through the host.");
const PROBLEMS = [
  ["Image has no image", "Readers see an empty space in Row 2.", "Add an image", "Row 2"],
  ["Image has no alt text", "If images are blocked, or for screen readers, Row 4 says nothing.", "Add alt text", "Row 4, Column 2"],
  ["“Add to bag” has no link", "Readers who click it go nowhere.", "Add link", "Row 4, Column 1"],
  ["frst_name isn’t one of your Merge Tags", "Readers would see {{frst_name}} where their name should be.", "Fix the Merge Tag", "Row 3"],
  ["Text is hard to read", "#B0A193 on #FBF7F1 is 2.4 to 1. Text this size needs 4.5 to 1.", "Change the color", "Row 6"],
  ["“Click here” doesn’t say where it goes", "Screen reader users often jump from link to link and hear only this.", "Change the text", "Row 3"],
  ["No unsubscribe link", "Your sending service, or the law where your readers live, may require one.", "Add the link", "Email"],
  ["No preheader", "Inboxes show the email’s first words instead: “Shop Subscriptions Journal”.", "Add a preheader", "Email"],
  ["No language", "Screen readers may read it in the wrong voice.", "Set the language", "Email"],
  ["142 KB, over Gmail’s 102 KB cut-off", "Gmail hides the end of the email, unsubscribe link included, behind “View entire message”.", "", "Email"],
];
const chk = ([t, p, b, w]) => `<div class="chk"><span class="ic w">${ic("alert", "sm")}</span><div><b>${t}</b><p>${p}</p>${b ? `<span class="btn sm">${b}</span> ` : ""}<span class="where">${w}</span></div></div>`;
const sideH = (sub, send) => `<div class="side-h"><div class="hrow"><h2>Before you export</h2>${send === "sending" ? `<span class="btn sm busy"><span class="spin d"></span>Sending…</span>` : `<span class="btn sm">${ic("send", "sm")}Send a test</span>`}</div><p>${sub}</p>${send === "sent" ? `<div class="sendst ok" role="status">${ic("check", "sm")}Test sent.</div>` : send === "failed" ? `<div class="sendst err" role="alert">${ic("alert", "sm")}<span>Your plan sends 10 tests a day. You've sent 10 today.</span></div>` : ""}</div>`;
const checkSide = (send) => `<aside class="side">${sideH("2 things to fix.", send)}
  <div class="sec"><h3>To fix<span>2</span></h3>${chk(PROBLEMS[1])}${chk(PROBLEMS[2])}</div>
  ${passedSec(PASSED)}</aside>`;
const tabs = (on, sample = true) => `<div class="subbar"><span class="seg t">${["Inbox", "Plain text", "HTML"].map((x) => `<span class="${x === on ? "on" : ""}">${x}</span>`).join("")}</span>${sample ? `<span class="pill">Show sample values<span class="tgl on"></span></span>` : ""}</div>`;
const checkApp = (main, side, clean) => `<div class="app panel">${topBar({ mode: "check", clean })}<main class="cv">${main}</main>${side}</div>`;
F.push({ id: "c04-check-many", html: () => checkApp(tabs("Inbox") + previews(email({ badTag: true }), `<div class="scaler">${email({ badTag: true }, true)}</div>`), `<aside class="side">${sideH("10 things to fix.")}<div class="list"><div class="sec" style="border:0"><h3>To fix<span>10</span></h3>${PROBLEMS.map(chk).join("")}</div><div class="fade"></div></div></aside>`).replace('Check<span class="count">2</span>', 'Check<span class="count">10</span>').replace(/— First harvest from Guji\. Your price holds until Friday\./g, "— Shop Subscriptions Journal") });
F.push({ id: "c05-no-sender", html: () => checkApp(tabs("Inbox") + previews(email({ sample: true }), `<div class="scaler">${email({ sample: true }, true)}</div>`).replace(/<div class="ih">[\s\S]*?<span class="t">/, `<div class="ih" style="grid-template-columns:1fr auto"><div><div class="sub"><span class="pre">First harvest from Guji. Your price holds until Friday.</span></div></div><span class="t">`), checkSide()) });
const PLAIN = `NORTHBOUND

Shop (https://northbound.co/shop)
Subscriptions (https://northbound.co/subscribe)
Journal (https://northbound.co/journal)

[Roaster pouring beans into the cooling tray]

THE SPRING ROAST IS HERE

Hi Ana, our first harvest of the year just landed from
Guji, Ethiopia. Bright, floral and gone by May. Your
price holds until Friday.

Shop the roast: https://northbound.co/spring?u=48213

[Roasted Guji beans, close up]
Ethiopia Guji
Peach, jasmine, black tea · 250 g
$18 Add to bag (https://northbound.co/p/guji)

Colombia Huila
Cocoa, red apple, cane sugar · 250 g
$16 Add to bag (https://northbound.co/p/huila)

“The only subscription I've never paused.”
Maya, subscriber since 2022

Instagram: https://instagram.com/northbound
Facebook: https://facebook.com/northbound
Website: https://northbound.co`;
F.push({ id: "c06-plain-text", html: () => checkApp(tabs("Plain text") + `<div class="paper"><div class="ph-h"><span>What email apps that show only text get. Made from the email; it can’t be edited.</span><span class="btn sm">${ic("dup", "sm")}Copy text</span></div><pre>${PLAIN}</pre></div>`, checkSide()) });
const HTML_SRC = `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>The spring roast is here</title>
  <style type="text/css">
    #outlook a { padding: 0; }
    body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; }
    table, td { border-collapse: collapse; mso-table-lspace: 0pt; }
    img { border: 0; height: auto; line-height: 100%; outline: none; }
    @media only screen and (max-width: 480px) {
      .mj-column-per-50 { width: 100% !important; max-width: 100%; }
    }
  </style>
</head>
<body style="word-spacing:normal;background-color:#efe8de;">
  <div style="display:none;font-size:1px;color:#ffffff;line-height:1px;">
    First harvest from Guji. Your price holds until Friday.
  </div>
  <div lang="en" dir="auto" style="background-color:#efe8de;">
    <table align="center" border="0" cellpadding="0" cellspacing="0"
      role="presentation" style="width:100%;max-width:600px;">
      <tbody>
        <tr>
          <td style="direction:ltr;font-size:0px;padding:22px 32px;">
            <div style="font-family:Arial, Helvetica, sans-serif;">`;
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const hl = (s) => esc(s).replace(/([a-z-]+)="([^"]*)"/g, '<span class="a">$1</span>=<span class="s">"$2"</span>').replace(/(&lt;\/?)([a-z!]+)/g, '$1<span class="t">$2</span>');
F.push({ id: "c07-html-copied", html: () => checkApp(tabs("HTML", false) + `<div class="paper" style="width:820px"><div class="ph-h"><span>41 KB · read only</span><span class="btn sm done">${ic("check", "sm")}Copied</span></div><div class="code"><div class="ln">${HTML_SRC.split("\n").map((_, i) => i + 1).join("\n")}</div><pre>${hl(HTML_SRC)}</pre></div></div>`, checkSide()) });
const inboxMain = () => tabs("Inbox") + previews(email({ sample: true }), `<div class="scaler">${email({ sample: true }, true)}</div>`);
F.push({ id: "c08a-test-sending", html: () => checkApp(inboxMain(), checkSide("sending")) });
F.push({ id: "c08b-test-sent", html: () => checkApp(inboxMain(), checkSide("sent")) });
F.push({ id: "c08c-test-failed", html: () => checkApp(inboxMain(), checkSide("failed")) });
F.push({ id: "c09-after-fix", html: () => app({ sel: 4, ctx: ctxImage.replace('<span class="fld" style="width:230px"><span class="lab">Alt</span>Roasted Guji beans, close up</span>', `<span class="anc"><span class="fld foc" style="width:230px"><span class="lab">Alt</span><span class="caret" style="background:var(--text);height:15px;margin-left:0"></span><span class="phd" style="margin-left:-6px">Describe the image</span></span><div class="tipcard" style="top:40px;left:0"><b>Image has no alt text</b><p style="margin:0">If images are blocked, or for screen readers, Row 4 says nothing.</p></div></span>`).replace('<span class="num focus">', '<span class="num">').replace("Row 4 /</span>Image", "Row 4 /</span>Column 2 / Image"), stage: "margin-top:-330px", email: email({ sel: "img2" }) }) });

// ---------- 7. Fuller settings, Show on, Phone values ----------
group("f0", "Fuller settings, Show on and Phone values", "Columns get settings; anything can show on all devices, desktop only or phones only; font size, padding and Image width can differ on phones. What's not on this device shows folded (default), faded or hidden, as the person picks in the ⋯ menu.");
const ctxColumn = `<div class="ctx">${chip("col", "Row 4", "Column 2")}
  <span class="lab">Background</span><span class="swf"><span class="sw none"></span><span class="dimtxt">None</span></span><span class="vr"></span>
  <span class="lab">Padding</span><span class="num">12<span class="u">px</span>${ic("chev", "sm")}</span><span class="vr"></span>
  <span class="lab">Align</span><span class="seg"><span class="ib on">${ic("vt", "sm")}</span><span class="ib">${ic("vm", "sm")}</span><span class="ib">${ic("vb", "sm")}</span></span><span class="vr"></span>
  <span class="lab">Border</span><span class="swf dimtxt">None${ic("chev", "sm")}</span><span class="vr"></span>${moreBtn()}</div>`;
F.push({ id: "f02-column", cls: "colsel", html: () => app({ sel: 4, ctx: ctxColumn, stage: "margin-top:-330px", email: email({}) }) });
const ROW5 = /<div class="r[^"]*" data-r="5">[\s\S]*?since 2022<\/div><\/div><\/div>/;
F.push({ id: "f03-hidden-mark", html: () => app({ sel: 0, ctx: ctxNone, stage: "margin-top:-560px", email: email({}).replace(ROW5, `<div class="hidstrip">${ic("phone", "sm")}Row 5 · Phones only</div>`) }) });
F.push({ id: "f03c-hidden-hide", html: () => app({ sel: 0, ctx: ctxNone, stage: "margin-top:-560px", email: email({}).replace(ROW5, "") }) });
F.push({ id: "f05-hidden-block", html: () => app({ sel: 3, ctx: ctxNone, stage: "margin-top:-300px", email: email({}).replace('<div class="b" style="margin:0 -12px 30px; padding:6px 12px"><span class="ebtn">Shop the roast</span></div>', `<div class="hidstrip" style="height:30px;margin:0 0 30px;border:0;border-radius:4px">${ic("phone", "sm")}Button · Phones only</div>`) }) });
F.push({ id: "f03b-hidden-faded", html: () => app({ sel: 0, ctx: ctxNone, stage: "margin-top:-560px", email: email({}).replace(ROW5, (m) => m.replace('<div class="r', '<div class="r faded').replace('data-r="5">', 'data-r="5"><span class="tag dark" style="top:8px;left:8px;border-radius:4px">' + ic("phone", "sm") + "Phones only</span>")) }) });
const ctxHeadPhone = `<div class="ctx">${chip("head", "Row 3", "Heading")}
  <span class="seg"><span class="ib on" style="width:auto;padding:0 8px">H1</span><span class="ib" style="width:auto;padding:0 8px">H2</span><span class="ib" style="width:auto;padding:0 8px">H3</span></span><span class="vr"></span>
  <span class="anc"><span class="num phv">${ic("phone", "sm")}28<span class="u">px</span><span class="x">${ic("x", "sm")}</span></span><div class="tipcard" style="top:40px;left:-20px"><b>Font size on phones</b><p>28px on phones, 36px on desktop.</p><span class="btn sm">Use the desktop value (36px)</span></div></span>
  <span class="swb"><span class="sw" style="background:#2b1d14"></span></span><span class="vr"></span>${segA()}<span class="vr"></span>${tail}${moreBtn()}</div>`;
const phoneTop = () => topBar({ mode: "edit" }).replace('<span class="ib on"><svg class="i sm"><use href="#desk"/></svg></span><span class="ib"><svg class="i sm"><use href="#phone"/></svg></span>', '<span class="ib"><svg class="i sm"><use href="#desk"/></svg></span><span class="ib on"><svg class="i sm"><use href="#phone"/></svg></span>');
F.push({ id: "f04-phone-value", html: () => app({ sel: 3, top: phoneTop(), ctx: ctxHeadPhone, extra: `<div class="pvcap">${ic("phone", "sm")}Phone, 375px</div>`, stage: "padding-top:92px", email: email({ sel: "h1", grip: false }, true).replace('<h1 class="h1">', '<h1 class="h1" style="font-size:28px">') }) });

// ---------- 8. Decorative image ----------
group("d0", "Decorative image", "Say an Image adds nothing to what the email says, so screen readers skip it and Check stops asking for alt text.");
const ctxDeco = `<div class="ctx">${chip("img", "Row 2", "Image")}
  <span class="btn sm ghost">${ic("img", "sm")}Replace</span><span class="vr"></span>
  <span class="swl"><span class="tgl on"></span>Decorative</span><span class="hint" style="padding:0 4px 0 0">Screen readers skip it.</span><span class="vr"></span>
  <span class="num">${ic("width", "sm")}Width: fill Column${ic("chev", "sm")}</span>
  <span class="anc"><span class="ib dim">${ic("link")}</span><span class="tip" style="top:36px;left:-60px">A decorative image can’t have a link</span></span><span class="vr"></span>${tail}${moreBtn()}</div>`;
F.push({ id: "d01-decorative", html: () => app({ sel: 2, ctx: ctxDeco, email: email({ sel: "hero", grip: true }) }) });

// ---------- 9. Menu Block ----------
group("k0", "Menu and Video Blocks", "A row of the website's links; a video shown as a thumbnail that links to it. The Video's Play button setting: below the picture (default), on the picture, or none.");
const menuSel = (inner) => email({}).replace('<span class="nav"><span>Shop</span><span>Subscriptions</span><span>Journal</span></span>', inner);
const ctxMenu = (open) => `<div class="ctx">${chip("menu", "Row 1", "Menu")}
  <span class="anc"><span class="btn sm"${open ? ' style="box-shadow:0 0 0 1px var(--accent);color:var(--accent-2)"' : ""}>${ic("link", "sm")}Links<span style="color:var(--text-3)">${open === 0 ? 0 : 3}</span>${ic("chev", "sm")}</span>${open ? open : ""}</span><span class="vr"></span>
  ${segA("r")}<span class="swb"><span class="sw" style="background:#5c4a3c"></span>Text</span>
  <span class="num">13<span class="u">px</span></span><span class="num">${ic("width", "sm")}22<span class="u">px</span></span><span class="vr"></span>${tail}${moreBtn()}</div>`;
const navSel = `<span class="nav b sel"><span class="tag">Menu</span><span>Shop</span><span>Subscriptions</span><span>Journal</span></span>`;
F.push({ id: "k01-menu", html: () => app({ sel: 1, ctx: ctxMenu(), email: menuSel(navSel) }) });
const linkRow = (l, u, err, first, last) => `<div class="lk2"><span class="g">${ic("grip", "sm")}</span><span class="fld">${l}</span><span class="fld${err ? " err" : ""}">${ic("link", "sm")}${u}</span><span class="acts2"><span class="ib${first ? " dim" : ""}">${ic("up", "sm")}</span><span class="ib${last ? " dim" : ""}">${ic("down", "sm")}</span><span class="ib">${ic("x", "sm")}</span></span></div>`;
const menuLinks = `<div class="pop" style="left:0;top:40px;width:520px;padding:8px;white-space:normal">
  <div class="hd"><span>Links, in the order they show</span></div>
  ${linkRow("Shop", "northbound.co/shop", false, true)}${linkRow("Subscriptions", "northbound.co/subscribe")}${linkRow("Journal", "northbound journal", true, false, true)}
  <div class="errtext">That isn’t a web address. Try one like northbound.co/journal.</div>
  <div style="padding:8px 4px 2px"><span class="btn sm">${ic("plus", "sm")}Add link</span></div></div>`;
F.push({ id: "k02-menu-links", html: () => app({ sel: 1, ctx: ctxMenu(menuLinks), email: menuSel(navSel) }) });
F.push({ id: "k03-menu-empty", html: () => app({ sel: 1, ctx: ctxMenu(0).replace(/<span class="anc">([\s\S]*?)<\/span><span class="vr">/, `<span class="anc"><span class="btn sm acc">${ic("plus", "sm")}Add link</span></span><span class="vr">`), email: menuSel(`<span class="nav b sel" style="padding:6px"><span class="tag">Menu</span><span class="menuempty">${ic("plus", "sm")}Add the links this menu shows</span></span>`) }) });
const videoRow = (inner, sel) => `<div class="r${sel ? "" : ""}" data-r="5"><div class="c vrow"><div class="b${sel ? " sel" : ""}" style="padding:8px;margin:-8px">${sel ? `<span class="tag">Video</span><span class="grip">${ic("grip", "sm")}</span>` : ""}${inner}</div></div></div>`;
const vThumb = (baked) => `<div class="vthumb"><img src="${P.board}" alt="">${baked ? `<span class="vbaked">${ic("play")}</span>` : ""}</div>${baked ? "" : `<div class="vplay"><i>${ic("play")}</i><u>Watch the video</u></div>`}`;
const PLAY = { below: "Below the picture", on: "On the picture", none: "None" };
const playMenu = (sel, noUpload) => `<div class="pop menu" style="right:0;top:38px;width:310px;white-space:normal">
  ${[["below", "A “Watch the video” line under it. Works in every email app."], ["on", noUpload ? "Needs image uploads, which this app doesn’t offer." : "A play button drawn into a copy of the thumbnail, uploaded for you."], ["none", "Just the picture. Some readers won’t know it’s a video."]].map(([k, d]) => `<div class="mi${noUpload && k === "on" ? " dim" : ""}${k === sel ? " on" : ""}" style="height:auto;padding:8px;align-items:start">${k === sel ? ic("check", "sm") : "<span></span>"}<span><span style="display:block">${PLAY[k]}</span><span style="color:var(--text-3);font-size:12px;line-height:1.4">${d}</span></span><kbd></kbd></div>`).join("")}</div>`;
const ctxVideo = (empty, play = "below", menu = "") => `<div class="ctx">${chip("video", "Row 5", "Video")}
  <span class="fld${empty ? " foc" : ""}" style="width:250px">${ic("link", "sm")}${empty ? `<span class="caret" style="background:var(--text);height:15px;margin-left:0"></span><span class="phd" style="margin-left:-6px">Paste a link to the video</span>` : "<span>youtube.com/watch?v=q8Ln2kXa</span>"}</span>
  <span class="btn sm${empty ? " off" : ""}"${empty ? ' style="opacity:.45"' : ""}>${ic("img", "sm")}${empty ? "Add a thumbnail" : "Thumbnail"}</span>
  <span class="fld" style="width:180px"><span class="lab">Alt</span>${empty ? '<span class="phd">Describe the thumbnail</span>' : "Roaster tipping beans"}</span><span class="vr"></span>
  <span class="anc"><span class="swb"${menu ? ' style="background:var(--hover)"' : ""}${empty ? ' style="opacity:.45"' : ""}><span class="lab">Play button</span>${PLAY[play]}${ic("chev", "sm")}</span>${menu}</span><span class="vr"></span>${tail}${moreBtn()}</div>`;
F.push({ id: "k04-video", html: () => app({ sel: 5, ctx: ctxVideo(), stage: "margin-top:-975px", email: email({}).replace(ROW5, videoRow(vThumb(false), true)) }) });
F.push({ id: "k05-video-empty", html: () => app({ sel: 5, ctx: ctxVideo(true), stage: "margin-top:-975px", email: email({}).replace(ROW5, videoRow(`<div class="vslot">${ic("video")}<b>Add a video</b>Paste its link in the bar above, then add a thumbnail. Readers click the thumbnail to watch it, since email can’t play video.</div>`, true)) }) });
F.push({ id: "k06-video-baked", html: () => app({ sel: 5, ctx: ctxVideo(false, "on"), stage: "margin-top:-975px", email: email({}).replace(ROW5, videoRow(vThumb(true), true)) }) });


// ---------- hover and focus, and More at narrower widths ----------
F.push({ id: "e10-bar-hover", html: () => app({ sel: 3, ctx: ctxButton.replace(`<span class="ib">${ic("dup")}</span>`, `<span class="anc"><span class="ib h">${ic("dup")}</span><span class="tip" style="top:36px;left:-34px">Duplicate<kbd>⌘D</kbd></span></span>`), email: email({ sel: "btn", hov: ["h1"] }) }) });
F.push({ id: "c10-check-focus", html: () => checkApp(inboxMain(), checkSide().replace('<span class="btn sm">Add alt text</span>', '<span class="btn sm focus">Add alt text</span>').replace(`<span class="btn sm">${ic("send", "sm")}Send a test</span>`, `<span class="btn sm" style="background:var(--hover)">${ic("send", "sm")}Send a test</span>`)) });
const ctxTextCompact = `<div class="ctx">${chip("text", "", "Text")}<span class="num">16<span class="u">px</span>${ic("chev", "sm")}</span><span class="swb"><span class="sw" style="background:#4a3a2e"></span></span><span class="vr"></span><span class="ib">${ic("bold")}</span><span class="ib">${ic("ital")}</span><span class="ib">${ic("link")}</span><span class="vr"></span>${moreBtn(true)}</div>`;
F.push({ id: "b03-more-1024", w: 1024, h: 768, html: () => app({ layout: "collapsed", left: collapsedRail(3), ctx: ctxTextMore, email: calloutText({ sel: "p", grip: true }), over: morePanel("morep") }) });
F.push({ id: "b04-drawer-1024", w: 1024, h: 768, html: () => app({ layout: "collapsed", left: collapsedRail(3), ctx: ctxTextCompact, email: calloutText({ sel: "p", grip: true }), right: morePanel("drawer") }).replace('<div class="app collapsed">', '<div class="app collapsed" style="grid-template-columns:52px 1fr 320px">') });
F.push({ id: "b05-more-768", w: 768, h: 1024, html: () => app({ layout: "plain", left: "", top: topBar({ mode: "edit", compact: true, railToggle: true }), ctx: ctxTextCompact, email: calloutText({ sel: "p", grip: true }), over: morePanel("morep") }) });
F.push({ id: "b06-drawer-768", w: 768, h: 1024, html: () => app({ layout: "plain", left: "", top: topBar({ mode: "edit", compact: true, railToggle: true }), ctx: ctxTextCompact, email: calloutText({ sel: "p", grip: true }), right: morePanel("drawer") }).replace('<div class="app plain">', '<div class="app plain" style="grid-template-columns:1fr 320px">') });

F.push({ id: "k07-video-play-menu", html: () => app({ sel: 5, ctx: ctxVideo(false, "below", playMenu("below")), stage: "margin-top:-975px", email: email({}).replace(ROW5, videoRow(vThumb(false), true)) }) });
F.push({ id: "k08-video-adding-button", html: () => app({ sel: 5, ctx: ctxVideo(false, "on"), stage: "margin-top:-975px", email: email({}).replace(ROW5, videoRow(`<div class="vthumb uploading"><img src="${P.board}" alt=""><span class="pill" style="top:50%"><span class="spin"></span>Adding the play button…</span></div>`, true)) }) });
F.push({ id: "k09-video-none", html: () => app({ sel: 5, ctx: ctxVideo(false, "none"), stage: "margin-top:-975px", email: email({}).replace(ROW5, videoRow(`<div class="vthumb"><img src="${P.board}" alt=""></div>`, true)) }) });
F.push({ id: "k10-video-no-uploads", html: () => app({ sel: 5, ctx: ctxVideo(false, "below", playMenu("below", true)), stage: "margin-top:-975px", email: email({}).replace(ROW5, videoRow(vThumb(false), true)) }) });
F.push({ id: "k11-video-cant-draw", html: () => app({ sel: 5, ctx: ctxVideo(false, "below").replace("youtube.com/watch?v=q8Ln2kXa", "vimeo.com/824190553"), stage: "margin-top:-975px", email: email({}).replace(ROW5, videoRow(vThumb(false), true)), over: `<div class="tipcard" style="left:calc(50% + 150px);top:58px;width:300px"><b>The play button couldn’t be added</b><p>vimeocdn.com doesn’t let the editor draw on its pictures. Upload the thumbnail instead, or keep the line below it.</p><span class="btn sm">Upload a thumbnail</span></div>` }) });

// ---------- 10. Phones ----------
group("p0", "Phones: the rest of the sheets", "Fix a typo or a link away from the desk. More, nothing selected, the top menu, the start screen, Check's tabs, fonts and Menu links.");
const scrim = `<div class="scrim2"></div>`;
F.push({ id: "p07-more-sheet", phone: true, html: () => `${mtopM("edit")}<div class="mcv">${calloutText({ sel: "p", grip: false }, true)}</div>${scrim}
  <div class="sheet"><div class="grab"></div><div class="sheet-h"><b>Text</b><span class="btn sm">Done</span></div>
  <div class="mp-s" style="border:0;padding-top:0"><h5>Box</h5>
    <div class="pr"><span>Padding</span><span class="v"><span class="num">16 · 20<span class="u">px</span>${ic("right", "sm")}</span></span></div>
    <div class="pr"><span>Background</span><span class="v"><span class="swf"><span class="sw" style="background:#efe6da"></span>#EFE6DA</span></span></div>
    <div class="pr"><span>Border</span><span class="v dimtxt">None${ic("right", "sm")}</span></div>
    <div class="pr"><span>Corners</span><span class="v"><span class="num">8<span class="u">px</span></span></span></div>
    <div class="note">${ic("info", "sm")}Outlook on Windows shows square corners.</div></div>
  <div class="mp-s"><h5>Show on</h5><div class="seg t"><span class="on">All devices</span><span>Desktop only</span><span>Phones only</span></div></div>
  <div class="mp-s" style="padding-bottom:0"><div class="mi">${ic("dup", "sm")}Copy<kbd></kbd></div><div class="mi">${ic("cut", "sm")}Cut<kbd></kbd></div><div class="mi">${ic("down", "sm")}Paste below<kbd></kbd></div><div class="mi dim">${ic("right", "sm")}Move to the next Column<kbd></kbd></div><div class="mi">${ic("rows", "sm")}Select Row 3<kbd></kbd></div></div>
  </div><div class="home"></div>` });
F.push({ id: "p08-nothing-selected", phone: true, html: () => `${mtopM("edit")}<div class="mcv">${email({}, true)}</div><div class="msel">Tap a Block to change it<span class="btn acc">${ic("plus", "sm")}Add</span></div><div class="home"></div>` });
F.push({ id: "p09-top-menu", phone: true, html: () => `${mtopM("edit")}<div class="mcv">${email({}, true)}</div>${scrim}
  <div class="sheet"><div class="grab"></div><div class="sheet-h"><div><b>Spring roast launch</b><div style="color:var(--text-3);font-size:13px">Saved</div></div><span class="btn sm">Done</span></div>
  <div class="mp-s" style="border:0;padding-top:4px"><h5>View</h5><div class="seg t"><span>${"Desktop"}</span><span class="on">Phone</span></div><div class="note" style="margin-top:8px">${ic("info", "sm")}Font size, padding and Image width you change in the Phone view apply on phones only.</div><h5 style="margin-top:14px">Not on this device</h5><div class="seg t"><span class="on">Fold</span><span>Fade</span><span>Hide</span></div></div>
  <div class="mp-s"><div class="mi">${ic("redo", "sm")}Redo<kbd></kbd></div><div class="mi">${ic("rows", "sm")}Rows<kbd>6</kbd></div></div>
  <div class="mp-s" style="padding-bottom:0"><div class="mi">${ic("export", "sm")}Export HTML file<kbd></kbd></div><div class="mi">${ic("file", "sm")}Export JSON file<kbd></kbd></div><div class="mi">${ic("import", "sm")}Import JSON…<kbd></kbd></div></div>
  </div><div class="home"></div>` });
F.push({ id: "p10-start", phone: true, html: () => `<div class="mtop"><span class="ib dim">${ic("undo")}</span><div class="modes"><span class="on">Edit</span><span style="opacity:.4">Style</span><span style="opacity:.4">Check</span></div><span class="ib">${ic("more")}</span></div>
  <div class="mstart"><h1>Start an email</h1><p>Begin from a starter email, or a blank one. You can change everything after.</p>
  <div class="starters"><div class="st-card blank"><div class="mini"><span>${ic("plus", "lg")}</span></div><b>Blank</b><small>An empty email</small></div>
  <div class="st-card"><div class="mini"><div class="sc" data-clone="1,2,3,4"></div></div><b>Product launch</b><small>Hero, two products, quote</small></div>
  <div class="st-card"><div class="mini"><div class="sc" data-clone="1,3x,5,6"></div></div><b>Letter</b><small>Heading, text, sign-off</small></div>
  <div class="st-card"><div class="mini"><div class="sc" data-clone="1,4,4,6"></div></div><b>Catalogue</b><small>Grid of products</small></div></div></div><div class="home"></div>` });
F.push({ id: "p11-check-text", phone: true, html: () => `${mtopM("check")}<div class="mcv" style="background:var(--work)"><div class="mtabs"><span class="seg t" style="width:300px;background:var(--chrome);box-shadow:var(--sh-bar)"><span>Inbox</span><span class="on">Plain text</span><span>HTML</span></span></div>
  <pre style="margin:56px 12px 0;padding:16px;background:var(--chrome);border-radius:10px;box-shadow:var(--sh-email);font:12.5px/1.6 ui-monospace,Menlo,monospace;color:var(--text);white-space:pre-wrap;height:560px;overflow:hidden">${PLAIN.replace("Hi Ana, our first harvest of the year just landed from\nGuji, Ethiopia. Bright, floral and gone by May. Your\nprice holds until Friday.", "Hi Ana, our first harvest of the year just landed from Guji, Ethiopia. Bright, floral and gone by May. Your price holds until Friday.")}</pre></div>
  <div class="mpeek"><div class="grab" style="width:36px;height:5px;border-radius:3px;background:var(--line-2);margin:0 auto 10px"></div><div class="row-flex" style="justify-content:space-between"><b style="font-size:15px">2 to fix</b><span class="btn sm">${ic("send", "sm")}Send a test</span></div></div><div class="home"></div>` });
F.push({ id: "p12-font-sheet", phone: true, html: () => `${mtopM("style")}<div class="mcv">${email({}, true)}</div>${scrim}
  <div class="sheet" style="padding-bottom:30px"><div class="grab"></div><div class="sheet-h"><span class="ib">${ic("left")}</span><b>Heading font</b><span class="btn sm">Done</span></div>
  ${fontPop("").replace('<div class="pop fontpop" style="right:16px;top:388px">', '<div style="margin:0 -6px">')}</div><div class="home"></div>` });
F.push({ id: "p13-menu-links", phone: true, html: () => `${mtopM("edit")}<div class="mcv">${email({}, true)}</div>${scrim}
  <div class="sheet"><div class="grab"></div><div class="sheet-h"><span class="ib">${ic("left")}</span><b>Menu links</b><span class="btn sm">Done</span></div>
  ${[["Shop", "northbound.co/shop"], ["Subscriptions", "northbound.co/subscribe"], ["Journal", "northbound.co/journal"]].map(([l, u], i) => `<div style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;padding:10px 0;border-top:${i ? "1px solid var(--line)" : "0"}"><div style="display:grid;gap:6px"><span class="fld" style="height:40px;font-size:15px">${l}</span><span class="fld" style="height:40px;font-size:15px">${ic("link", "sm")}${u}</span></div><div style="display:grid;gap:2px"><span class="ib${i === 0 ? " dim" : ""}">${ic("up")}</span><span class="ib${i === 2 ? " dim" : ""}">${ic("down")}</span><span class="ib">${ic("x")}</span></div></div>`).join("")}
  <span class="btn" style="width:100%;justify-content:center;height:40px;margin-top:6px">${ic("plus", "sm")}Add link</span></div><div class="home"></div>` });


// ---------- phones: the rest ----------
const phoneCheck = (send) => `${mtopM("check")}<div class="mcv" style="background:var(--work)"><div class="mtabs"><span class="seg t" style="width:300px;background:var(--chrome);box-shadow:var(--sh-bar)"><span class="on">Inbox</span><span>Plain text</span><span>HTML</span></span></div>
  <div style="margin-top:56px;background:#fff;font-family:var(--ui);color:#18181b;padding:10px 14px;display:grid;grid-template-columns:32px 1fr;gap:10px;align-items:center;border-bottom:1px solid #ececef"><span class="av" style="width:32px;height:32px">N</span><div style="min-width:0"><b style="font-size:14px">Northbound Roasters</b><div style="font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">The spring roast is here <span style="color:#71717a">— First harvest from Guji.</span></div></div></div>
  <div style="background:#efe8de">${email({ sample: true }, true)}</div></div>
  <div class="sheet" style="height:${send === "failed" ? 372 : 330}px"><div class="grab"></div><div class="sheet-h"><div><b>2 to fix</b><div style="color:var(--text-3);font-size:13px">8 passed</div></div><span class="btn sm${send === "sending" ? " busy" : ""}">${send === "sending" ? `<span class="spin d"></span>Sending…` : `${ic("send", "sm")}Send a test`}</span></div>
    ${send === "failed" ? `<div class="sendst err" role="alert" style="margin:-4px 0 12px">${ic("alert", "sm")}<span>Your plan sends 10 tests a day. You've sent 10 today.</span></div>` : ""}
    ${chk(PROBLEMS[1])}${chk(PROBLEMS[2])}
  </div><div class="home"></div>`;
F.push({ id: "p18-test-failed", phone: true, html: () => phoneCheck("failed") });
const rowNames = ["Header", "Image", "Heading, Text, Button", "Two products", "Quote", "Footer"];
F.push({ id: "p14-rows-sheet", phone: true, html: () => `${mtopM("edit")}<div class="mcv">${email({}, true)}</div>${scrim}
  <div class="sheet"><div class="grab"></div><div class="sheet-h"><span class="ib">${ic("left")}</span><b>Rows</b><span class="btn sm">Done</span></div>
  ${rowNames.map((n, i) => `<div style="display:grid;grid-template-columns:20px 72px 1fr auto;gap:10px;align-items:center;padding:6px 4px;border-radius:10px;${i === 2 ? "background:var(--accent-soft);" : ""}"><span style="color:var(--text-3);font-size:13px;text-align:right">${i + 1}</span><span style="height:40px;border-radius:5px;overflow:hidden;background:#fbf7f1;box-shadow:0 0 0 1px var(--line);position:relative"><span class="sc" data-clone="${i + 1}" style="position:absolute;width:600px;transform:scale(.12);transform-origin:0 0"></span></span><span style="font-size:15px">${n}${i === 4 ? `<span style="display:block;color:var(--text-3);font-size:12px">Desktop only</span>` : ""}</span><span class="row-flex"><span class="ib${i === 0 ? " dim" : ""}">${ic("up")}</span><span class="ib${i === 5 ? " dim" : ""}">${ic("down")}</span></span></div>`).join("")}
  <span class="btn" style="width:100%;justify-content:center;height:40px;margin-top:10px">${ic("plus", "sm")}Add a Row</span></div><div class="home"></div>` });
F.push({ id: "p15-row-selected", phone: true, html: () => `${mtopM("edit")}<div class="mcv"><div style="margin-top:-470px">${email({ row: 4 }, true)}</div></div>
  <div class="mbar"><span class="ib on">${ic("rows", "lg")}</span><span style="font-weight:600;font-size:15px;margin-right:auto">Row 4</span><span class="swb" style="font-size:14px">${lay([1, 1], false)}Columns</span><span class="ib">${ic("pad", "lg")}</span><span class="ib">${ic("more", "lg")}</span></div><div class="home"></div>` });
F.push({ id: "p16-image-more", phone: true, html: () => `${mtopM("edit")}<div class="mcv"><div style="margin-top:-470px">${email({ sel: "img1", grip: false }, true)}</div></div>${scrim}
  <div class="sheet"><div class="grab"></div><div class="sheet-h"><b>Image</b><span class="btn sm">Done</span></div>
  <div class="pr"><span>Decorative</span><span class="tgl"></span></div>
  <div style="display:grid;gap:6px;margin:6px 0 10px"><span style="color:var(--text-2)">Alt text</span><span class="fld" style="height:40px">Roasted Guji beans, close up</span></div>
  <div class="pr"><span>Width</span><span class="v"><span class="num phv">${ic("phone", "sm")}160<span class="u">px</span><span class="x">${ic("x", "sm")}</span></span></span></div>
  <div class="note">${ic("info", "sm")}On phones only. Desktop fills the Column.</div>
  <div class="mp-s" style="margin-top:8px"><h5>Show on</h5><div class="seg t"><span class="on">All devices</span><span>Desktop only</span><span>Phones only</span></div></div>
  </div><div class="home"></div>` });
F.push({ id: "p17-errors", phone: true, html: () => `${mtopM("edit")}<div class="msgbar" style="position:absolute;top:52px;left:0;right:0;height:auto;padding:10px 14px;font-size:13px;line-height:1.4;z-index:7;align-items:flex-start">${ic("alert", "sm")}<span>This browser can’t save your email here. Export it as JSON to keep it.</span></div><div class="mcv" style="top:112px">${email({ sel: "p", grip: false }, true)}</div>${scrim}
  <div class="sheet"><div class="grab"></div><div class="sheet-h"><b>Link</b><span class="btn sm acc" style="opacity:.45">Apply</span></div>
  <div class="fld err" style="height:44px">${ic("link", "sm")}<span>northbound guji</span></div>
  <div class="errtext">That isn’t a web address. Try one like northbound.co/guji, an email address, or a Merge Tag.</div>
  <div style="margin-top:14px"><span class="btn" style="width:100%;justify-content:center;height:40px">Remove link</span></div></div><div class="home"></div>` });
F.push({ id: "p19-empty-email", phone: true, html: () => `<div class="mtop"><span class="ib dim">${ic("undo")}</span><div class="modes"><span class="on">Edit</span><span style="opacity:.4">Style</span><span style="opacity:.4">Check</span></div><span class="ib">${ic("more")}</span></div>
  <div class="mcv" style="display:grid;place-items:center;padding:16px"><div class="slotrow" style="width:100%;background:#fbf7f1"><b>Start with a Row</b>Pick how many Columns it has. You can change it after.<div class="lts" style="flex-wrap:wrap">${LAYOUTS.map((w) => `<span>${w.map((x) => `<b style="flex:${x}"></b>`).join("")}</span>`).join("")}</div></div></div><div class="home"></div>` });
F.push({ id: "p20-video", phone: true, html: () => `${mtopM("edit")}<div class="mcv"><div style="margin-top:-900px">${email({}, true).replace(/<div class="r[^"]*" data-r="6">/, (m) => videoRow(vThumb(false), true).replace('class="c vrow"', 'class="c vrow" style="padding:4px 16px 24px"') + m)}</div></div>
  <div class="mbar"><span class="ib on">${ic("video", "lg")}</span><span class="fld" style="flex:1;height:44px">${ic("link", "sm")}<span>youtube.com/watch…</span></span><span class="ib">${ic("img", "lg")}</span><span class="ib">${ic("more", "lg")}</span></div><div class="home"></div>` });

// Selection bar states the picked frames don't draw (#315).
group("g0", "Selection bar: more states (#315)", "Picked on 2026-11-26 for #315: the Divider's and Spacer's bars, the email's own settings in the bar with the rest under More, More for a Button and a Row, and a Text Block's bar with the format bar staying at its text.");

const BTN_BLOCK = '<div class="b" style="margin:0 -12px 30px; padding:6px 12px"><span class="ebtn">Shop the roast</span></div>';
const withBlockAfterButton = (block) => email({}).replace(BTN_BLOCK, BTN_BLOCK + block);
const selTag = (label) => `<span class="tag">${label}</span><span class="grip">${ic("grip", "sm")}</span>`;
const dividerBlock = `<div class="b sel" style="margin:-14px -12px 18px; padding:12px 12px">${selTag("Divider")}<div style="border-top:1px solid #d9cbb8"></div></div>`;
const spacerBlock = `<div class="b sel" style="margin:-14px -12px 18px; height:24px">${selTag("Spacer")}</div>`;

const ctxDivider = `<div class="ctx">${chip("divider", "Row 3", "Divider")}
  <span class="swb"><span class="sw" style="background:#d9cbb8"></span>Color</span><span class="vr"></span>
  <span class="lab">Thickness</span><span class="num">1<span class="u">px</span></span><span class="vr"></span>${tail}${moreBtn()}</div>`;
F.push({ id: "g01-divider", html: () => app({ sel: 3, ctx: ctxDivider, email: withBlockAfterButton(dividerBlock) }) });

const ctxSpacer = `<div class="ctx">${chip("spacer", "Row 3", "Spacer")}
  <span class="lab">Height</span><span class="num">24<span class="u">px</span></span><span class="vr"></span>${tail}${moreBtn()}</div>`;
F.push({ id: "g02-spacer", html: () => app({ sel: 3, ctx: ctxSpacer, email: withBlockAfterButton(spacerBlock) }) });

// A: the email's most-used settings in the bar, the rest under More.
const ctxEmailA = `<div class="ctx">
  <span class="chip"><span class="ico">${ic("mail")}</span>Email</span><span class="vr"></span>
  <span class="fld" style="width:300px;overflow:hidden;white-space:nowrap"><span class="lab">Preheader</span>First harvest from Guji. Your pri…</span>
  <span class="fld" style="width:118px"><span class="lab">Language</span>en</span>
  <span class="lab">Width</span><span class="num">600<span class="u">px</span></span><span class="vr"></span>${moreBtn()}</div>`;
F.push({ id: "g03-email-in-bar", html: () => app({ sel: 0, ctx: ctxEmailA, email: email({}) }) });
const emailMore = (cls) => `<div class="${cls}">
  <div class="mp-h"><div><b>Email</b></div><span class="ib">${ic("x")}</span></div>
  <div class="mp-s"><h5>Look</h5>
    <div class="pr"><span>Background color</span><span class="v"><span class="swf"><span class="sw" style="background:#efe8de"></span>#EFE8DE</span></span></div>
    <div class="pr"><span>Font</span><span class="v"><span class="swf">Georgia${ic("chev", "sm")}</span></span></div>
  </div></div>`;
F.push({ id: "g04-email-more", html: () => app({ layout: "rail drawerapp", sel: 0, ctx: ctxEmailA.replace(moreBtn(), moreBtn(true)), email: email({}), right: emailMore("drawer") }).replace('<div class="app rail drawerapp">', '<div class="app rail drawerapp" style="grid-template-columns:232px 1fr 320px">') });

// More for a Button: its own setting that didn't fit, then the actions. Box and Show on come with #323 and #324.
const buttonMore = `<div class="drawer">
  <div class="mp-h"><div><b>Button</b><small>Row 3, Column 1</small></div><span class="ib">${ic("x")}</span></div>
  <div class="mp-s"><h5>Button</h5>
    <div style="display:grid;gap:6px;margin:4px 0 6px"><span style="color:var(--text-2)">Label</span><span class="fld" style="width:auto">Shop the roast</span></div>
  </div>
  <div class="mp-s"><h5>Actions</h5>
    <div class="mi">${ic("dup", "sm")}Copy<kbd>⌘C</kbd></div>
    <div class="mi">${ic("cut", "sm")}Cut<kbd>⌘X</kbd></div>
    <div class="mi">${ic("down", "sm")}Paste below<kbd>⌘V</kbd></div>
    <div class="mi dim">${ic("left", "sm")}Move to the Column before<kbd>⌥←</kbd></div>
    <div class="mi dim">${ic("right", "sm")}Move to the next Column<kbd>⌥→</kbd></div>
    <div class="mi">${ic("rows", "sm")}Select Row 3<kbd></kbd></div>
  </div></div>`;
F.push({ id: "g06-button-more", html: () => app({ layout: "rail drawerapp", sel: 3, ctx: ctxButton.replace(/<span class="ib">(\s*)?<svg class="i "><use href="#more"\/><\/svg><\/span>\s*<\/div>$/, `<span class="ib on">${ic("more")}</span></div>`), email: email({ sel: "btn" }), right: buttonMore }).replace('<div class="app rail drawerapp">', '<div class="app rail drawerapp" style="grid-template-columns:232px 1fr 320px">') });

// More for a Row.
const rowMore = `<div class="drawer">
  <div class="mp-h"><div><b>Row 4</b><small>2 Columns</small></div><span class="ib">${ic("x")}</span></div>
  <div class="mp-s"><h5>Row</h5>
    <div class="pr"><span>Background color</span><span class="v"><span class="swf"><span class="sw none"></span><span class="dimtxt">None</span></span></span></div>
    <div class="pr"><span>Hide on phones</span><span class="tgl"></span></div>
    <div class="note">${ic("info", "sm")}Readers on phones don't see this Row.</div>
  </div>
  <div class="mp-s"><h5>Actions</h5>
    <div class="mi">${ic("dup", "sm")}Copy<kbd>⌘C</kbd></div>
    <div class="mi">${ic("cut", "sm")}Cut<kbd>⌘X</kbd></div>
    <div class="mi">${ic("down", "sm")}Paste below<kbd>⌘V</kbd></div>
  </div></div>`;
F.push({ id: "g07-row-more", html: () => app({ layout: "rail drawerapp", sel: 4, ctx: ctxRow.replace(/<span class="ib">(\s*)?<svg class="i "><use href="#more"\/><\/svg><\/span>\s*<\/div>$/, `<span class="ib on">${ic("more")}</span></div>`), stage: "margin-top:-330px", email: email({ row: 4 }), right: rowMore }).replace('<div class="app rail drawerapp">', '<div class="app rail drawerapp" style="grid-template-columns:232px 1fr 320px">') });

// Text, as the ticket says: the format bar stays beside the text; the bar has the Block's own settings.
const ctxTextOwn = `<div class="ctx">${chip("text", "Row 3", "Text")}
  <span class="num">16<span class="u">px</span></span>
  <span class="swb"><span class="sw" style="background:#4a3a2e"></span>Color</span><span class="vr"></span>
  ${segA()}<span class="vr"></span>${tail}${moreBtn()}</div>`;
const formatBar = `<div class="pop" style="left:calc(50% - 300px + 24px); top:668px; padding:4px; display:flex; gap:2px; align-items:center">
  <span class="ib">${ic("bold")}</span><span class="ib">${ic("ital")}</span><span class="ib">${ic("under")}</span><span class="vr"></span>
  <span class="ib">${ic("ul")}</span><span class="ib">${ic("ol")}</span><span class="vr"></span><span class="ib">${ic("link")}</span><span class="ib">${ic("braces")}</span></div>`;
F.push({ id: "g08-text-format-at-text", html: () => app({ sel: 3, ctx: ctxTextOwn, email: email({ sel: "p", edit: "text", grip: true }).replace("{{first_na", ""), over: formatBar }) });

// Rows list states, after buildRails has drawn the thumbnails.
AFTER.push(() => {
  document.querySelectorAll(".thumbs[data-lift]").forEach((t) => {
    const ths = t.querySelectorAll(".th");
    const lift = ths[+t.dataset.lift - 1]; lift.classList.add("lifted");
    const g = ths[+t.dataset.grip - 1]; g.insertAdjacentHTML("beforeend", `<span class="tgrip">${ic("grip", "sm")}</span>`);
    const ghost = t.closest(".app").querySelector("[data-lift-ghost]");
    const railR = t.closest(".rail-p").getBoundingClientRect(), r = ths[1].getBoundingClientRect();
    ghost.style.left = "52px"; ghost.style.top = (r.top - railR.top - 40) + "px"; g.classList.add("hasgrip");
  });
  document.querySelectorAll(".thumbs[data-kfocus]").forEach((t) => {
    const th = t.querySelectorAll(".th")[+t.dataset.kfocus - 1]; th.classList.add("kfocus");
    const tip = t.closest(".app").querySelector("[data-tipfor]"); const fr = t.closest(".frame").getBoundingClientRect(), r = th.getBoundingClientRect(), cv = tip.parentElement.getBoundingClientRect();
    tip.style.position = "absolute"; tip.style.left = "12px"; tip.style.top = (r.top - cv.top + r.height / 2 - 13) + "px";
  });
  document.querySelectorAll(".frame[id^='f03'] .th .bdg use").forEach((u) => u.setAttribute("href", "#phone"));
});

AFTER.push(() => {
  document.querySelectorAll("section.frame").forEach((fr) => {
    const em = fr.querySelector(".stage > .em:not(.m)"); const t = fr.querySelector(".thumbs"); if (!em || !t) return;
    // Only thumbnails of the email's own Rows: an inserted new Row has no picture and no source Row.
    [...t.querySelectorAll(".th")].filter((th) => th.querySelector(".sc")).forEach((th, i) => {
      const own = em.querySelector(`[data-r="${(i % 6) + 1}"]`); const sc = th.querySelector(".sc"); if (!own || +t.dataset.total) return;
      const c = own.cloneNode(true); c.classList.remove("sel", "hov"); c.querySelectorAll(".tag,.grip,.insl,.pop,.tip,.tipcard").forEach((x) => x.remove()); c.querySelectorAll(".sel,.hov").forEach((x) => x.classList.remove("sel", "hov"));
      sc.replaceChildren(c); th.querySelector(".card").style.height = Math.max(Math.round(own.offsetHeight * 0.3), 18) + "px";
    });
  });
  document.querySelectorAll(".thumbs[data-scroll]").forEach((t) => { const sel = t.querySelector(".th.sel"); if (sel) t.scrollTop = sel.offsetTop - t.clientHeight / 2 + sel.offsetHeight / 2; });
});
// Group headings between frames.
AFTER.push(() => {
  for (const [prefix, title, job] of G) {
    const first = document.querySelector(`section.frame[id^="${prefix}"]`);
    if (first) first.insertAdjacentHTML("beforebegin", `<div class="group-h">${title}<small>${job}</small></div>`);
  }
  document.querySelectorAll("section.frame").forEach((f) => f.insertAdjacentHTML("beforebegin", `<div class="frame-l">${f.id}</div>`));
});
