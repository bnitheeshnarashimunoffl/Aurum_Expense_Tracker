import html2pdf from 'html2pdf.js'

/**
 * Converts an offscreen-rendered report element to a PDF Blob, then shares it via the
 * Web Share API (files) when available — this is what opens the iOS share sheet — or
 * falls back to a plain download link.
 */
export async function exportReportToPdf(element: HTMLElement, filename: string): Promise<void> {
  const worker = html2pdf()
    .set({
      margin: 0,
      filename,
      image: { type: 'jpeg', quality: 0.92 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' },
    })
    .from(element)

  const blob: Blob = await worker.outputPdf('blob')
  const file = new File([blob], filename, { type: 'application/pdf' })

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title: filename })
    return
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
