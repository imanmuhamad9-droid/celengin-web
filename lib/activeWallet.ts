// Dompet yang sedang dilihat di kartu saldo Home (null = semua). Form Catat memakainya sebagai dompet awal.
let activeWalletId: string | null = null;
export const getActiveWallet = () => activeWalletId;
export const setActiveWallet = (id: string | null) => { activeWalletId = id; };
