export function productLossPercent(product) {
  const sold = product?.quantity_sold
  const loss = product?.loss_quantity
  if (sold === null || sold === undefined || sold === '' || Number(sold) <= 0 || !Number.isFinite(Number(sold))) return null
  if (loss === null || loss === undefined || loss === '' || !Number.isFinite(Number(loss))) return null
  return (Number(loss) / Number(sold)) * 100
}
