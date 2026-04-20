import { useCallback, useEffect, useState } from 'react'
import { Modal } from 'react-bootstrap'
import Cropper from 'react-easy-crop'
import { getCroppedImageFile } from '../utils/cropImage.js'

const MIN_ZOOM = 0.4
const MAX_ZOOM = 4

export default function CropModal({ file, onCancel, onAccept }) {
  const [src, setSrc] = useState(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [areaPixels, setAreaPixels] = useState(null)
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!file) {
      setSrc(null)
      return
    }
    const url = URL.createObjectURL(file)
    setSrc(url)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setAreaPixels(null)
    setError(null)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const onCropComplete = useCallback((_a, areaPx) => {
    setAreaPixels(areaPx)
  }, [])

  async function aceptar() {
    if (!src || !areaPixels) return
    setProcesando(true)
    setError(null)
    try {
      const base = file?.name?.replace(/\.[^.]+$/, '') || 'crop'
      const result = await getCroppedImageFile(src, areaPixels, `${base}.jpg`)
      onAccept(result)
    } catch (e) {
      setError(e.message)
    } finally {
      setProcesando(false)
    }
  }

  return (
    <Modal show={!!file} onHide={onCancel} centered>
      <Modal.Header closeButton>
        <Modal.Title>Recortar imagen</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {src && (
          <>
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: 320,
                background: '#f1f3f5',
                borderRadius: 6,
                overflow: 'hidden',
              }}
            >
              <Cropper
                image={src}
                crop={crop}
                zoom={zoom}
                aspect={1}
                objectFit="contain"
                minZoom={MIN_ZOOM}
                maxZoom={MAX_ZOOM}
                restrictPosition={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>
            <div className="mt-3">
              <label className="form-label small m-0">Zoom</label>
              <input
                type="range"
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step="0.01"
                value={zoom}
                className="form-range"
                onChange={(e) => setZoom(Number(e.target.value))}
              />
            </div>
          </>
        )}
        {error && <div className="alert alert-danger mt-2 mb-0">{error}</div>}
      </Modal.Body>
      <Modal.Footer>
        <button type="button" className="btn btn-outline-secondary" onClick={onCancel}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={aceptar}
          disabled={procesando || !areaPixels}
        >
          {procesando ? 'Procesando…' : 'Aceptar'}
        </button>
      </Modal.Footer>
    </Modal>
  )
}
