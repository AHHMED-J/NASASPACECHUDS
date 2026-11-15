// Marco estático: la foto del dispositivo de muñeca del astronauta y, dentro de su pantalla, la app.
// La app se dibuja en un lienzo lógico fijo (LOGICAL_W × LOGICAL_H) y se escala con CSS para caber en la pantalla.
import { useEffect, useRef, useState } from 'react'
import frame from '../assets/device-frame.jpg'

// Imagen de 1600 × 1068 px; la pantalla azul ocupa x 602–1104, y 308–704 (medido sobre los píxeles).
const IMG_W = 1600, IMG_H = 1068
const SCREEN = { x: 602, y: 308, w: 502, h: 396 }
// Recorte de la foto que siempre debe verse completo (acercamiento elegido por el equipo, ~1.23×).
// Se centra en la ventana; si la ventana es más ancha o más alta, se ve más foto alrededor.
const VIEW = { x: 111, y: 72, w: 1304, h: 885 }
export const LOGICAL_W = 1280
export const LOGICAL_H = Math.round((LOGICAL_W * SCREEN.h) / SCREEN.w) // 1010, misma proporción que la pantalla

const pct = (v, total) => `${(100 * v) / total}%`

export default function DeviceFrame({ children }) {
  const screenRef = useRef(null)
  const [scale, setScale] = useState(0)

  useEffect(() => {
    const el = screenRef.current
    const ro = new ResizeObserver(([e]) => setScale(e.contentRect.width / LOGICAL_W))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div className="device-stage">
      <div className="device-frame" style={{
        '--s': `min(calc(100vw / ${VIEW.w}), calc(100dvh / ${VIEW.h}))`, // px de pantalla por px de la foto
        width: `calc(${IMG_W} * var(--s))`, aspectRatio: `${IMG_W} / ${IMG_H}`,
        left: `calc(50vw - ${VIEW.x + VIEW.w / 2} * var(--s))`, top: `calc(50dvh - ${VIEW.y + VIEW.h / 2} * var(--s))`,
      }}>
        <img className="device-photo" src={frame} alt="" draggable="false" />
        <div
          ref={screenRef}
          className="device-screen"
          style={{ left: pct(SCREEN.x, IMG_W), top: pct(SCREEN.y, IMG_H), width: pct(SCREEN.w, IMG_W), height: pct(SCREEN.h, IMG_H) }}
        >
          <div className="device-canvas" style={{ width: LOGICAL_W, height: LOGICAL_H, transform: `scale(${scale})` }}>
            {scale > 0 && children}
          </div>
        </div>
      </div>
    </div>
  )
}
