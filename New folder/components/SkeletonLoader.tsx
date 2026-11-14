export default function SkeletonLoader() {
  return (
    <div className="max-w-md mx-auto px-5 mt-6 space-y-6 animate-pulse">
      {/* Skeleton Header/Profil */}
      <div className="flex justify-between items-end">
        <div className="space-y-2">
          <div className="h-3 bg-gray-200 rounded-md w-24"></div>
          <div className="h-6 bg-gray-300 rounded-md w-40"></div>
        </div>
        <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
      </div>

      {/* Skeleton Kartu Saldo Utama */}
      <div className="h-40 bg-gray-300 rounded-3xl w-full"></div>

      {/* Skeleton Kartu Grafik */}
      <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm h-48 flex flex-col justify-between">
        <div className="flex justify-between">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
        </div>
        <div className="flex items-end justify-between gap-2 h-24">
          <div className="w-full bg-gray-200 rounded-t-sm h-1/2"></div>
          <div className="w-full bg-gray-200 rounded-t-sm h-3/4"></div>
          <div className="w-full bg-gray-200 rounded-t-sm h-1/3"></div>
          <div className="w-full bg-gray-200 rounded-t-sm h-2/3"></div>
          <div className="w-full bg-gray-200 rounded-t-sm h-full"></div>
          <div className="w-full bg-gray-200 rounded-t-sm h-1/2"></div>
          <div className="w-full bg-gray-200 rounded-t-sm h-1/4"></div>
        </div>
      </div>

      {/* Skeleton List Menu / Riwayat */}
      <div className="space-y-3">
        <div className="h-5 bg-gray-200 rounded-md w-1/4 mb-4"></div>
        <div className="h-16 bg-gray-200 rounded-2xl w-full"></div>
        <div className="h-16 bg-gray-200 rounded-2xl w-full"></div>
        <div className="h-16 bg-gray-200 rounded-2xl w-full"></div>
      </div>
    </div>
  );
}