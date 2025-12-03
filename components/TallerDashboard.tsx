
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import type { Cliente, Trabajo, Gasto, JobStatus, TallerInfo } from '../types';
import Dashboard from './Dashboard';
import Trabajos from './Trabajos';
import Clientes from './Clientes';
import Ajustes from './Ajustes';
import Header from './Header';
import { ChartPieIcon, WrenchScrewdriverIcon, UsersIcon, Cog6ToothIcon } from '@heroicons/react/24/solid';
import { applyAppTheme, applyFontSize } from '../constants';

interface TallerDashboardProps {
    onLogout: () => void;
}

type View = 'dashboard' | 'trabajos' | 'clientes' | 'ajustes';

const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: ChartPieIcon },
    { id: 'trabajos', label: 'Trabajos', icon: WrenchScrewdriverIcon },
    { id: 'clientes', label: 'Clientes', icon: UsersIcon },
    { id: 'ajustes', label: 'Ajustes', icon: Cog6ToothIcon },
] as const;

const TallerDashboard: React.FC<TallerDashboardProps> = ({ onLogout }) => {
    const [view, setView] = useState<View>(() => (localStorage.getItem('taller_view') as View) || 'dashboard');
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [trabajos, setTrabajos] = useState<Trabajo[]>([]);
    const [gastos, setGastos] = useState<Gasto[]>([]);
    const [tallerInfo, setTallerInfo] = useState<TallerInfo>({
        nombre: 'Mi Taller',
        telefono: '',
        direccion: '',
        cuit: '',
        pdfTemplate: 'classic',
        mobileNavStyle: 'sidebar',
        showLogoOnPdf: false,
        showCuitOnPdf: true,
        logoUrl: undefined,
        headerColor: '#334155', // Default Slate 700
        appTheme: 'slate',
        fontSize: 'normal'
    });
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // Modified fetchData to allow silent updates (without triggering full screen loading state)
    const fetchData = useCallback(async (showLoader = true) => {
        // SOLUCIÓN CRÍTICA: Solo mostramos el loader si es la primera carga o se solicita explícitamente.
        // Si showLoader es false (refresco silencioso), NO tocamos el estado setLoading(true).
        if (showLoader) {
            setLoading(true);
        }
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Fetch Taller Info from dedicated table
            const { data: tallerInfoData, error: tallerInfoError } = await supabase
                .from('taller_info')
                .select('*')
                .eq('taller_id', user.id)
                .maybeSingle();

            if (!tallerInfoError && tallerInfoData) {
                // Map snake_case database columns to camelCase TallerInfo type
                const loadedInfo: TallerInfo = {
                    nombre: tallerInfoData.nombre || '',
                    telefono: tallerInfoData.telefono || '',
                    direccion: tallerInfoData.direccion || '',
                    cuit: tallerInfoData.cuit || '',
                    logoUrl: tallerInfoData.logo_url,
                    pdfTemplate: tallerInfoData.pdf_template || 'classic',
                    mobileNavStyle: tallerInfoData.mobile_nav_style || 'sidebar',
                    showLogoOnPdf: tallerInfoData.show_logo_on_pdf === true, // Ensure boolean
                    showCuitOnPdf: tallerInfoData.show_cuit_on_pdf !== false, // Default to true if null/undefined
                    headerColor: tallerInfoData.header_color || '#334155',
                    appTheme: tallerInfoData.app_theme || 'slate',
                    fontSize: tallerInfoData.font_size || 'normal', // Map font_size from DB (assuming snake_case in DB logic below)
                };
                setTallerInfo(loadedInfo);
                
                // Apply visual settings immediately
                if (loadedInfo.appTheme) applyAppTheme(loadedInfo.appTheme);
                if (loadedInfo.fontSize) applyFontSize(loadedInfo.fontSize);

            } else if (!tallerInfoData) {
                // Fallback to metadata if table is empty (migration scenario)
                if (user.user_metadata?.taller_info) {
                    setTallerInfo(prev => ({ ...prev, ...user.user_metadata.taller_info }));
                }
            }

            // Fetch Clientes
            const { data: clientesData, error: clientesError } = await supabase
                .from('clientes')
                .select('*, vehiculos(*)')
                .eq('taller_id', user.id);
            
            if (clientesError) throw clientesError;
            if (clientesData) setClientes(clientesData as Cliente[]);

            // Fetch Trabajos
            const { data: trabajosData, error: trabajosError } = await supabase
                .from('trabajos')
                .select('*')
                .eq('taller_id', user.id);

            if (trabajosError) throw trabajosError;
            
            if (trabajosData) {
                 const mappedTrabajos = trabajosData.map(t => ({
                    id: t.id,
                    tallerId: t.taller_id,
                    clienteId: t.cliente_id,
                    vehiculoId: t.vehiculo_id,
                    descripcion: t.descripcion,
                    partes: t.partes,
                    costoManoDeObra: t.costo_mano_de_obra,
                    costoEstimado: t.costo_estimado,
                    status: t.status,
                    fechaEntrada: t.fecha_entrada,
                    fechaSalida: t.fecha_salida,
                    kilometraje: t.kilometraje,
                }));
                setTrabajos(mappedTrabajos as Trabajo[]);
            }

            // Fetch Gastos
            const { data: gastosData, error: gastosError } = await supabase
                .from('gastos')
                .select('*')
                .eq('taller_id', user.id)
                .order('fecha', { ascending: false });

            if (gastosError) throw gastosError;
            if (gastosData) setGastos(gastosData);

        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            // Solo desactivamos el loader si se había activado (ya sea por showLoader o porque estaba activo)
            // Para asegurar que si era silent refresh, no haga nada raro, pero si era initial load, lo quite.
            if (showLoader) {
                setLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        fetchData(true); // Initial load with spinner
    }, [fetchData]);

    useEffect(() => {
        localStorage.setItem('taller_view', view);
        setIsMobileMenuOpen(false);
        setSearchQuery(''); // Reset search when changing views
    }, [view]);
    
    // Silent refresh handler to pass down to children.
    // Explicitly passes 'false' to ensure UI doesn't flicker/reset.
    const handleSilentRefresh = () => fetchData(false);

    const handleUpdateStatus = async (trabajoId: string, newStatus: JobStatus) => {
        try {
            const { error } = await supabase
                .from('trabajos')
                .update({ status: newStatus })
                .eq('id', trabajoId);
            
            if (error) throw error;
            
            setTrabajos(prev => prev.map(t => 
                t.id === trabajoId ? { ...t, status: newStatus } : t
            ));
        } catch (error) {
            console.error("Error updating status:", error);
        }
    };

    const handleUpdateTallerInfo = async (newInfo: TallerInfo) => {
        try {
             const { data: { user } } = await supabase.auth.getUser();
             if (!user) return;

             // Update in Database Table
             // Note: Ensure the DB table has font_size column. If not, supabase will ignore it or return error depending on config.
             const { error: dbError } = await supabase.from('taller_info').upsert({
                 taller_id: user.id,
                 nombre: newInfo.nombre,
                 telefono: newInfo.telefono,
                 direccion: newInfo.direccion,
                 cuit: newInfo.cuit,
                 logo_url: newInfo.logoUrl,
                 pdf_template: newInfo.pdfTemplate,
                 mobile_nav_style: newInfo.mobileNavStyle,
                 show_logo_on_pdf: newInfo.showLogoOnPdf,
                 show_cuit_on_pdf: newInfo.showCuitOnPdf,
                 header_color: newInfo.headerColor,
                 app_theme: newInfo.appTheme,
                 font_size: newInfo.fontSize, // New Field
                 updated_at: new Date().toISOString()
             });

             if (dbError) throw dbError;

             // Keep metadata in sync just in case, but app relies on DB now
             await supabase.auth.updateUser({
                 data: { taller_info: newInfo }
             });

             setTallerInfo(newInfo);
             
             // Ensure visuals are applied
             if (newInfo.appTheme) applyAppTheme(newInfo.appTheme);
             if (newInfo.fontSize) applyFontSize(newInfo.fontSize);

        } catch (error: any) {
            console.error("Error updating taller info:", error);
            alert(`Error al guardar configuración: ${error.message || 'Error desconocido'}. Verifique si la columna 'font_size' existe en la base de datos.`);
            throw error;
        }
    };

    const renderContent = () => {
        switch (view) {
            case 'dashboard':
                return <Dashboard clientes={clientes} trabajos={trabajos} gastos={gastos} onDataRefresh={handleSilentRefresh} searchQuery={searchQuery} />;
            case 'trabajos':
                return <Trabajos trabajos={trabajos} clientes={clientes} onUpdateStatus={handleUpdateStatus} onDataRefresh={handleSilentRefresh} tallerInfo={tallerInfo} searchQuery={searchQuery} />;
            case 'clientes':
                return <Clientes clientes={clientes} trabajos={trabajos} onDataRefresh={handleSilentRefresh} searchQuery={searchQuery} />;
            case 'ajustes':
                return <Ajustes tallerInfo={tallerInfo} onUpdateTallerInfo={handleUpdateTallerInfo} onLogout={onLogout} searchQuery={searchQuery} />;
            default:
                return <Dashboard clientes={clientes} trabajos={trabajos} gastos={gastos} onDataRefresh={handleSilentRefresh} searchQuery={searchQuery} />;
        }
    };

    const sidebarClasses = `fixed inset-y-0 left-0 z-30 w-64 bg-white dark:bg-gray-800 transform transition-transform duration-300 ease-in-out shadow-lg md:translate-x-0 md:static md:inset-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`;

    return (
        // Usamos h-[100dvh] para que la app ocupe siempre el 100% del viewport dinámico en móviles
        // y overflow-hidden para evitar que el contenedor principal haga scroll.
        <div className="flex h-[100dvh] bg-taller-light dark:bg-taller-dark text-taller-dark dark:text-taller-light overflow-hidden transition-colors duration-300">
            {/* Sidebar Navigation */}
            <aside className={sidebarClasses}>
                <div className="h-full flex flex-col">
                    <div className="h-20 flex items-center justify-center border-b dark:border-gray-700">
                         {tallerInfo.logoUrl ? (
                            <img src={tallerInfo.logoUrl} alt="Logo" className="h-12 object-contain"/>
                        ) : (
                            <WrenchScrewdriverIcon className="h-10 w-10 text-taller-primary" />
                        )}
                    </div>
                    <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
                        {navItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setView(item.id as View)}
                                className={`w-full flex items-center px-4 py-3 rounded-lg transition-colors ${
                                    view === item.id
                                        ? 'bg-taller-primary text-white shadow-md'
                                        : 'text-taller-gray dark:text-gray-400 hover:bg-taller-light dark:hover:bg-gray-700'
                                }`}
                            >
                                <item.icon className="h-6 w-6 mr-3" />
                                <span className="font-medium">{item.label}</span>
                            </button>
                        ))}
                    </nav>
                    <div className="p-4 border-t dark:border-gray-700">
                         <div className="text-xs text-center text-taller-gray dark:text-gray-500">
                            &copy; {new Date().getFullYear()} Gestor Taller
                        </div>
                    </div>
                </div>
            </aside>

            {/* Overlay for mobile sidebar */}
            {isMobileMenuOpen && (
                <div 
                    className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <Header 
                    tallerName={tallerInfo.nombre} 
                    logoUrl={tallerInfo.logoUrl}
                    onMenuClick={() => setIsMobileMenuOpen(true)} 
                    showMenuButton={tallerInfo.mobileNavStyle === 'sidebar'}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                />
                
                {/* El scroll ocurre SOLO aquí adentro */}
                <main className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth overscroll-contain">
                    {loading ? (
                        <div className="flex h-full items-center justify-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-taller-primary"></div>
                        </div>
                    ) : (
                        renderContent()
                    )}
                </main>

                {/* Bottom Navigation for Mobile (optional via settings) */}
                {tallerInfo.mobileNavStyle === 'bottom_nav' && (
                    <div className="md:hidden bg-white dark:bg-gray-800 border-t dark:border-gray-700 pb-5 flex-shrink-0">
                         <nav className="flex justify-around items-center h-16">
                            {navItems.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => setView(item.id as View)}
                                    className={`flex flex-col items-center justify-center w-full h-full ${
                                        view === item.id ? 'text-taller-primary' : 'text-taller-gray dark:text-gray-400'
                                    }`}
                                >
                                    <item.icon className="h-6 w-6" />
                                    <span className="text-[10px] mt-1">{item.label}</span>
                                </button>
                            ))}
                        </nav>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TallerDashboard;
