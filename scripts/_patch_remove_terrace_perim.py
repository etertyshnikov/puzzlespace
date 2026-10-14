from pathlib import Path

tag = "di" + "v"
end = f"</{tag}>"
opn = f"<{tag}>"

p = Path(__file__).resolve().parents[1] / "frontend/src/pages/ProjectSpecifications.tsx"
text = p.read_text(encoding="utf-8")
old = (
    f"                      {opn}\n"
    f"                        {opn} style={{{{ fontSize: 12, color: '#73879C', marginBottom: 2 }}}}>{end}\n"
    f"                        {opn} style={{{{ fontSize: 14, fontWeight: 600, color: '#2A3F54' }}}}>{end}\n"
    f"                      {end}\n"
    f"                      {opn}\n"
    f"                        {opn} style={{{{ fontSize: 12, color: '#73879C', marginBottom: 2 }}}}>Длина домокомплекта, м{end}"
)
new = (
    f"                      {opn}\n"
    f"                        {opn} style={{{{ fontSize: 12, color: '#73879C', marginBottom: 2 }}}}>Длина домокомплекта, м{end}"
)
log = Path(__file__).resolve().parents[1] / "patch_result.txt"
if old not in text:
    log.write_text("pattern not found\n", encoding="utf-8")
    raise SystemExit(1)
p.write_text(text.replace(old, new, 1), encoding="utf-8")
log.write_text("ok\n", encoding="utf-8")
