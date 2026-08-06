type FloatingVariant = 'hero' | 'soft' | 'admin';

interface FloatingShapesProps {
  variant?: FloatingVariant;
  className?: string;
}

const shapesByVariant: Record<FloatingVariant, { className: string; delay: string }[]> = {
  hero: [
    { className: 'floating-shape floating-shape--hero-1 w-72 h-72 -top-20 -right-16', delay: '0s' },
    { className: 'floating-shape floating-shape--hero-2 w-56 h-56 top-1/3 -left-12', delay: '-2s' },
    { className: 'floating-shape floating-shape--hero-3 w-40 h-40 bottom-32 right-1/4', delay: '-4s' },
    { className: 'floating-shape floating-shape--hero-4 w-24 h-24 top-24 left-1/3 rounded-2xl', delay: '-1s' },
    { className: 'floating-shape floating-shape--hero-5 w-16 h-16 bottom-48 left-16 rounded-full', delay: '-3s' },
  ],
  soft: [
    { className: 'floating-shape floating-shape--soft-1 w-64 h-64 -top-16 -right-10', delay: '0s' },
    { className: 'floating-shape floating-shape--soft-2 w-48 h-48 bottom-20 -left-8', delay: '-3s' },
    { className: 'floating-shape floating-shape--soft-3 w-32 h-32 top-1/2 right-8 rounded-3xl', delay: '-5s' },
  ],
  admin: [
    { className: 'floating-shape floating-shape--admin-1 w-80 h-80 -top-24 -left-20', delay: '0s' },
    { className: 'floating-shape floating-shape--admin-2 w-64 h-64 bottom-0 right-0', delay: '-2s' },
    { className: 'floating-shape floating-shape--admin-3 w-36 h-36 top-1/4 right-1/4 rounded-2xl', delay: '-4s' },
  ],
};

export default function FloatingShapes({ variant = 'soft', className = '' }: FloatingShapesProps) {
  const shapes = shapesByVariant[variant];

  return (
    <div
      className={`floating-shapes pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      aria-hidden
    >
      {shapes.map((shape, i) => (
        <div
          key={i}
          className={shape.className}
          style={{ animationDelay: shape.delay }}
        />
      ))}
    </div>
  );
}
