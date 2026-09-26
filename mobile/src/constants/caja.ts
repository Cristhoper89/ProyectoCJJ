import { apiRequest } from './api';

export type Caja = {
  id: number;
  fecha?: string | null;
  ingresos_efectivo?: number | string | null;
  ingresos_tarjeta?: number | string | null;
  ingresos_transferencia?: number | string | null;
  egresos_efectivo?: number | string | null;
  egresos_tarjeta?: number | string | null;
  egresos_transferencia?: number | string | null;
  total_propinas?: number | string | null;
  balance_inicial?: number | string | null;
  balance_final?: number | string | null;
  efectivo_contado?: number | string | null;
  diferencia_caja?: number | string | null;
  notas_cierre?: string | null;
  estado?: string | null;
};

export type MovimientoCaja = {
  id: number;
  id_caja?: number | null;
  total?: number | string | null;
  propina?: number | string | null;
  domicilio?: number | string | null;
  metodo?: string | null;
  estado?: boolean | null;
  fecha_hora?: string | null;
};

export type GastoCaja = {
  id: number;
  id_caja?: number | null;
  nombre: string;
  descripcion?: string | null;
  valor?: number | string | null;
  fecha_hora?: string | null;
};

export type CajaData = {
  cajas: Caja[];
  movimientos: MovimientoCaja[];
  gastos: GastoCaja[];
};

export type CajaResumen = {
  ingresos: { efectivo: number; tarjeta: number; transferencia: number; otros: number };
  egresos: { efectivo: number; tarjeta: number; transferencia: number; sinMetodo: number };
  totalIngresos: number;
  totalEgresos: number;
  propinas: number;
  balanceEstimado: number;
};

export const amount = (value?: number | string | null) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const money = (value?: number | string | null) => `$${Math.round(amount(value)).toLocaleString('es-CO')}`;

export const parsePesos = (value: string) => Number(value.replace(/\D/g, '')) || 0;

export const isCajaAbierta = (caja: Caja) => caja.estado?.trim().toLowerCase() === 'abierta';

export const formatCajaDate = (value?: string | null) => {
  if (!value) return 'Fecha sin registrar';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Fecha sin registrar'
    : date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
};

export async function loadCajaData(): Promise<CajaData> {
  const [cajas, movimientos, gastos] = await Promise.all([
    apiRequest<Caja[]>('/cajas/'),
    apiRequest<MovimientoCaja[]>('/movimientos/'),
    apiRequest<GastoCaja[]>('/gastos/'),
  ]);
  return { cajas, movimientos, gastos };
}

export function summarizeCaja(caja: Caja, movimientos: MovimientoCaja[], gastos: GastoCaja[]): CajaResumen {
  const ventas = movimientos.filter((movimiento) => (
    movimiento.id_caja === caja.id && movimiento.estado !== false && amount(movimiento.total) > 0
  ));
  const gastosCaja = gastos.filter((gasto) => gasto.id_caja === caja.id);
  const ingresos = { efectivo: 0, tarjeta: 0, transferencia: 0, otros: 0 };

  ventas.forEach((venta) => {
    const method = (venta.metodo || '').trim().toLowerCase();
    if (method === 'efectivo') ingresos.efectivo += amount(venta.total);
    else if (method === 'tarjeta') ingresos.tarjeta += amount(venta.total);
    else if (method === 'transferencia') ingresos.transferencia += amount(venta.total);
    else ingresos.otros += amount(venta.total);
  });

  if (ventas.length === 0) {
    ingresos.efectivo = amount(caja.ingresos_efectivo);
    ingresos.tarjeta = amount(caja.ingresos_tarjeta);
    ingresos.transferencia = amount(caja.ingresos_transferencia);
  }

  const egresos = {
    efectivo: amount(caja.egresos_efectivo),
    tarjeta: amount(caja.egresos_tarjeta),
    transferencia: amount(caja.egresos_transferencia),
    sinMetodo: 0,
  };
  const totalIngresos = ingresos.efectivo + ingresos.tarjeta + ingresos.transferencia + ingresos.otros;
  const gastosRegistrados = gastosCaja.reduce((sum, gasto) => sum + amount(gasto.valor), 0);
  const egresosClasificados = egresos.efectivo + egresos.tarjeta + egresos.transferencia;
  egresos.sinMetodo = Math.max(0, gastosRegistrados - egresosClasificados);
  const totalEgresos = Math.max(gastosRegistrados, egresosClasificados);
  const propinas = ventas.length > 0
    ? ventas.reduce((sum, venta) => sum + amount(venta.propina), 0)
    : amount(caja.total_propinas);

  return {
    ingresos,
    egresos,
    totalIngresos,
    totalEgresos,
    propinas,
    balanceEstimado: amount(caja.balance_inicial) + totalIngresos - totalEgresos - propinas,
  };
}