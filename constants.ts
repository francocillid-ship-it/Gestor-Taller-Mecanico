
export const MAINTENANCE_TYPES = {
    FLUIDS: [
        { key: 'oil', label: 'Aceite de Motor', keywords: ['aceite motor', 'cambio aceite', '5w30', '10w40', '5w40', 'semisintetico', 'sintetico', 'elaion', 'total', 'shell', 'motul'] },
        { key: 'transmission_fluid', label: 'Aceite Transmisión', keywords: ['transmision', 'caja', 'valvulina', 'atf', 'cvt', 'caja manual', 'caja automatica', 'diferencial'] },
        { key: 'coolant', label: 'Refrigerante', keywords: ['refrigerante', 'anticongelante', 'agua radiador', 'coolant', 'paraflu'] },
        { key: 'brake_fluid', label: 'Líquido de Frenos', keywords: ['liquido frenos', 'liquido de freno', 'dot3', 'dot4'] },
    ],
    FILTERS: [
        { key: 'oil_filter', label: 'Filtro Aceite', keywords: ['filtro aceite', 'filtro de aceite'] },
        { key: 'air_filter', label: 'Filtro Aire', keywords: ['filtro aire', 'filtro de aire', 'filtro motor'] },
        { key: 'fuel_filter', label: 'Filtro Combustible', keywords: ['filtro nafta', 'filtro gasoil', 'filtro combustible', 'filtro diesel'] },
        { key: 'cabin_filter', label: 'Filtro Habitáculo', keywords: ['filtro habitaculo', 'filtro polen', 'filtro aire acondicionado'] },
    ],
    OTHERS: [
        { key: 'timing_belt', label: 'Distribución', keywords: ['distribucion', 'correa dentada', 'tensor', 'bomba agua'] },
        { key: 'brakes', label: 'Frenos', keywords: ['pastillas', 'discos', 'frenos', 'cinta de freno', 'rectificacion'] },
        { key: 'spark_plugs', label: 'Bujías', keywords: ['bujias', 'cables de bujia', 'bobina'] },
        { key: 'battery', label: 'Batería', keywords: ['bateria', 'acumulador'] },
        { key: 'tires', label: 'Neumáticos', keywords: ['cubiertas', 'neumaticos', 'alineacion', 'balanceo'] },
    ]
};

export const ALL_MAINTENANCE_OPTS = [
    ...MAINTENANCE_TYPES.FLUIDS,
    ...MAINTENANCE_TYPES.FILTERS,
    ...MAINTENANCE_TYPES.OTHERS
];
