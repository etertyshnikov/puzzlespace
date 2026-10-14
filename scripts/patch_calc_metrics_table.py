from pathlib import Path

p = Path(__file__).resolve().parents[1] / "frontend/src/pages/ProjectSpecifications.tsx"
text = p.read_text(encoding="utf-8")
marker_start = "                      Расчётные показатели\n                    </summary>\n"
idx = text.find(marker_start)
if idx < 0:
    raise SystemExit("marker_start not found")
idx = idx + len(marker_start)
flex = "display: 'flex'"
flex_idx = text.find(flex, idx)
if flex_idx < 0 or flex_idx > idx + 200:
    raise SystemExit("flex block not found")
block_start = text.rfind("\n                    <", idx, flex_idx)
if block_start < 0:
    block_start = text.rfind("<", idx, flex_idx)
else:
    block_start += 1
block_end = text.find("\n                  </details>", flex_idx)
if block_end < 0:
    raise SystemExit("details end not found")
close = text.rfind("\n                    </", flex_idx, block_end)
block_end = text.find(">", close) + 1

d = "di" + "v"
opn = "<" + d + ">"
cls = "</" + d + ">"

new = f"""                    {opn} style={{{{ paddingTop: 10, paddingBottom: 4, overflowX: 'auto' }}}}>
                      <table className="table table-striped" style={{{{ marginBottom: 0, maxWidth: 520 }}}}>
                        <thead>
                          <tr>
                            <th>Показатель</th>
                            <th style={{{{ width: 120, textAlign: 'right' }}}}>Значение</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td style={{{{ color: '#73879C' }}}}>Периметр дома, м</td>
                            <td style={{{{ textAlign: 'right', fontWeight: 600, color: '#2A3F54' }}}}>{{formatCalcDim(housePerimeterM)}}</td>
                          </tr>
                          <tr>
                            <td style={{{{ color: '#73879C' }}}}>Площадь дома, м²</td>
                            <td style={{{{ textAlign: 'right', fontWeight: 600, color: '#2A3F54' }}}}>{{formatCalcDim(houseAreaM2)}}</td>
                          </tr>
                          <tr>
                            <td style={{{{ color: '#73879C' }}}}>Площадь террасы, м²</td>
                            <td style={{{{ textAlign: 'right', fontWeight: 600, color: '#2A3F54' }}}}>{{formatCalcDim(terraceAreaM2)}}</td>
                          </tr>
                          <tr>
                            <td style={{{{ color: '#73879C' }}}}>Длина домокомплекта, м</td>
                            <td style={{{{ textAlign: 'right', fontWeight: 600, color: '#2A3F54' }}}}>{{formatCalcDim(kitLengthM)}}</td>
                          </tr>
                          <tr>
                            <td style={{{{ color: '#73879C' }}}}>Ширина домокомплекта, м</td>
                            <td style={{{{ textAlign: 'right', fontWeight: 600, color: '#2A3F54' }}}}>{{formatCalcDim(kitWidthM)}}</td>
                          </tr>
                          <tr>
                            <td style={{{{ color: '#73879C' }}}}>Периметр домокомплекта, м</td>
                            <td style={{{{ textAlign: 'right', fontWeight: 600, color: '#2A3F54' }}}}>{{formatCalcDim(kitPerimeterM)}}</td>
                          </tr>
                          <tr>
                            <td style={{{{ color: '#73879C' }}}}>Площадь домокомплекта, м²</td>
                            <td style={{{{ textAlign: 'right', fontWeight: 600, color: '#2A3F54' }}}}>{{formatCalcDim(kitAreaM2)}}</td>
                          </tr>
                        </tbody>
                      </table>
                    {cls}"""

out = text[:block_start] + new + text[block_end:]
p.write_text(out, encoding="utf-8")
(Path(__file__).resolve().parents[1] / "patch_calc_table_ok.txt").write_text("ok\n", encoding="utf-8")
