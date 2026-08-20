let excelPromise

export const loadExcelJS = () => {
  if (!excelPromise) excelPromise = import('exceljs').then(module => module.default || module)
  return excelPromise
}
