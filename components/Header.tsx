
import React, { useState, useRef, useEffect } from 'react';
import { MagnifyingGlassIcon, Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';

interface HeaderProps {
    tallerName: string;
    logoUrl?: string;
    onMenuClick?: () => void;
    showMenuButton?: boolean;
    searchQuery: string;
    onSearchChange: (query: string) => void;
}

const Header: React.FC<HeaderProps> = ({ tallerName, logoUrl, onMenuClick, showMenuButton, searchQuery, onSearchChange }) => {
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const mobileInputRef = useRef<HTMLInputElement>(null);

    const handleOpenSearch = () => {
        setIsSearchExpanded(true);
    };

    // Usamos un useEffect para el foco. En móviles, el foco debe ocurrir lo más cerca posible del evento de touch/click.
    // Al separar la expansión del foco, el navegador a veces bloquea el teclado.
    // Al usar este efecto con la dependencia de isSearchExpanded, el input ya está en el DOM visible cuando pedimos el foco.
    useEffect(() => {
        if (isSearchExpanded && mobileInputRef.current) {
            mobileInputRef.current.focus();
            // Reforzamos para navegadores más estrictos
            const timer = setTimeout(() => {
                mobileInputRef.current?.focus();
            }, 10);
            return () => clearTimeout(timer);
        }
    }, [isSearchExpanded]);

    const handleCloseSearch = () => {
        setIsSearchExpanded(false);
    };

    return (
        <header className="relative h-20 flex items-center justify-between px-4 md:px-6 bg-white dark:bg-gray-800 shadow-md dark:shadow-none dark:border-b dark:border-gray-700 z-10 flex-shrink-0">
            
            {/* --- Left Side: Logo & Menu --- */}
            <div className="flex items-center gap-2 md:gap-4 z-0 flex-1 min-w-0 mr-2">
                 {showMenuButton && (
                    <button onClick={onMenuClick} className="md:hidden p-2 -ml-2 text-taller-gray hover:text-taller-dark dark:hover:text-taller-light flex-shrink-0">
                        <Bars3Icon className="h-6 w-6" />
                    </button>
                )}
                
                {/* Logo: Solo visible en móvil (md:hidden) para evitar duplicidad con el sidebar */}
                {logoUrl && (
                    <div className="md:hidden relative h-14 flex items-center max-w-full">
                        <img 
                            src={logoUrl} 
                            alt={tallerName} 
                            className="h-full w-auto object-contain max-w-[50vw]" 
                        />
                    </div>
                )}

                {/* Nombre del taller: Visible siempre en escritorio, o en móvil si no hay logo */}
                <h2 className={`text-lg md:text-xl font-bold text-taller-dark dark:text-taller-light truncate ${logoUrl ? 'hidden md:block' : 'block'}`}>
                    {tallerName}
                </h2>
            </div>

            {/* --- Right Side: Search Controls --- */}
            <div className="flex items-center flex-shrink-0 z-0">
                
                {/* 1. Mobile Search Trigger Button */}
                <button 
                    onClick={handleOpenSearch}
                    className={`md:hidden p-2 text-gray-500 hover:text-taller-primary rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-opacity duration-200 ${isSearchExpanded ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                    aria-label="Buscar"
                >
                    <MagnifyingGlassIcon className="h-6 w-6" />
                </button>

                {/* 2. Desktop Search Input (Hidden on mobile) */}
                <div className="hidden md:flex relative items-center w-64 lg:w-80">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                    </div>
                    <input
                        type="text"
                        placeholder="Buscar..."
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="block w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:outline-none focus:bg-white dark:focus:bg-gray-600 focus:ring-1 focus:ring-taller-primary focus:border-taller-primary sm:text-sm transition-shadow duration-150 ease-in-out"
                    />
                     {searchQuery && (
                        <button 
                             onClick={() => onSearchChange('')}
                             className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        >
                             <XMarkIcon className="h-4 w-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* --- Mobile Search Overlay --- */}
            <div className={`
                md:hidden absolute inset-0 z-20 bg-white dark:bg-gray-800 flex items-center px-4
                transition-all duration-300 ease-out origin-right
                ${isSearchExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10 pointer-events-none'}
            `}>
                <div className="relative flex-grow">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                    </div>
                    <input
                        ref={mobileInputRef}
                        type="text"
                        placeholder="Buscar..."
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="block w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:outline-none focus:bg-white dark:focus:bg-gray-600 focus:ring-1 focus:ring-taller-primary focus:border-taller-primary sm:text-sm"
                    />
                    {searchQuery && (
                        <button 
                                onClick={() => onSearchChange('')}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        >
                                <XMarkIcon className="h-4 w-4" />
                        </button>
                    )}
                </div>
                <button 
                    onClick={handleCloseSearch}
                    className="ml-3 p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-200"
                >
                    Cancelar
                </button>
            </div>
        </header>
    );
};

export default Header;
