export default function Logo({ size = 32 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2">
      <img 
        src="/icon.png" 
        alt="Celengin Logo" 
        width={size} 
        height={size} 
        className="rounded-xl object-contain"
      />
      <span className="font-bold text-xl text-sky-800 dark:text-sky-400">Celengin.</span>
    </div>
  );
}