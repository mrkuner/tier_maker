const MAX_SIZE = 512

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export async function getCroppedImageFile(imageSrc, croppedAreaPixels, name = 'crop.jpg') {
  const image = await loadImage(imageSrc)
  const scale = Math.min(1, MAX_SIZE / croppedAreaPixels.width)
  const outW = Math.round(croppedAreaPixels.width * scale)
  const outH = Math.round(croppedAreaPixels.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, outW, outH)
  ctx.drawImage(
    image,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
    0,
    0,
    outW,
    outH,
  )
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('No se pudo generar la imagen recortada'))
        resolve(new File([blob], name, { type: 'image/jpeg' }))
      },
      'image/jpeg',
      0.9,
    )
  })
}
