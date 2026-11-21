// Gambar latar Kartu Saldo. Selalu menutup penuh kotaknya (seperti object-fit: cover), berapa pun tinggi kartu.
// Zoom memperbesar dari ukuran "cover"; pos ("x% y%") menentukan bagian gambar yang tampil.
// Dipakai bersama oleh kartu di Home dan pratinjau di Pengaturan, jadi hasilnya sama persis.
export function parseBgPos(pos: string): [number, number] {
  const m = (pos || '').match(/(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%/);
  return m ? [Number(m[1]), Number(m[2])] : [50, 50];
}

export default function CardBgLayer({ url, pos, zoom }: { url: string; pos: string; zoom: number }) {
  const [px, py] = parseBgPos(pos);
  const z = Math.max(1, zoom || 1);
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <div
        className="absolute"
        style={{
          width: `${z * 100}%`,
          height: `${z * 100}%`,
          left: `${-(z - 1) * px}%`,
          top: `${-(z - 1) * py}%`,
          backgroundImage: `url(${url})`,
          backgroundSize: 'cover',
          backgroundPosition: `${px}% ${py}%`,
          backgroundRepeat: 'no-repeat',
        }}
      />
    </div>
  );
}
