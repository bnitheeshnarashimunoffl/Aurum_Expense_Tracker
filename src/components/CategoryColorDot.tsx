export default function CategoryColorDot({ color, size = 10 }: { color: string; size?: number }) {
  return (
    <span
      className="inline-block flex-shrink-0 rounded-full"
      style={{ width: size, height: size, backgroundColor: color }}
    />
  )
}
