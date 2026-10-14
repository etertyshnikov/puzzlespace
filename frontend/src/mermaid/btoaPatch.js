/** UTF-8-safe btoa для Mermaid (кириллица в подписях диаграмм) */
if (typeof window !== 'undefined' && !window.__mermaidBtoaPatched) {
  const nativeBtoa = window.btoa.bind(window)
  window.btoa = (input) => {
    try {
      return nativeBtoa(input)
    } catch {
      const bytes = new TextEncoder().encode(String(input))
      let binary = ''
      for (let i = 0; i < bytes.length; i += 1) {
        binary += String.fromCharCode(bytes[i])
      }
      return nativeBtoa(binary)
    }
  }
  window.__mermaidBtoaPatched = true
}
