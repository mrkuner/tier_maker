import { useCallback, useState } from 'react'
import { Modal, Button } from 'react-bootstrap'

export function useConfirm() {
  const [state, setState] = useState(null)

  const confirm = useCallback((opts) => {
    return new Promise((resolve) => {
      setState({ resolve, ...opts })
    })
  }, [])

  const close = (result) => {
    state?.resolve(result)
    setState(null)
  }

  const element = (
    <ConfirmModal
      show={!!state}
      title={state?.title}
      message={state?.message}
      confirmText={state?.confirmText}
      cancelText={state?.cancelText}
      variant={state?.variant}
      icon={state?.icon}
      onConfirm={() => close(true)}
      onCancel={() => close(false)}
    />
  )

  return { confirm, element }
}

export default function ConfirmModal({
  show,
  title = 'Confirmar',
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'primary',
  icon,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal show={show} onHide={onCancel} centered>
      <Modal.Header closeButton>
        <Modal.Title className="d-flex align-items-center gap-2">
          {icon && <i className={`bi ${icon}`}></i>}
          {title}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {typeof message === 'string' ? <p className="m-0">{message}</p> : message}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onCancel}>
          {cancelText}
        </Button>
        <Button variant={variant} onClick={onConfirm}>
          {confirmText}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
