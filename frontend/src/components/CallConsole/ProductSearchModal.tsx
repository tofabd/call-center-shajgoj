import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Search, Package, Loader2 } from 'lucide-react';
import api from '../../services/api';

interface Product {
  id: number;
  name: string;
  sku: string;
  price: string;
  regular_price: string;
  stock_status: string;
}

interface ProductSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onProductSelect: (product: Product) => void;
}

const ProductSearch: React.FC<ProductSearchProps> = ({
  isOpen,
  onClose,
  onProductSelect
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [hasMoreProducts, setHasMoreProducts] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousSearchTermRef = useRef<string>('');
  const loaderRef = useRef<HTMLDivElement>(null);

  // Debounce search term
  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      if (searchTerm.length >= 3) {
        setDebouncedSearchTerm(searchTerm);
      } else {
        setDebouncedSearchTerm('');
      }
    }, 300);

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [searchTerm]);

  // Reset products when search term actually changes
  useEffect(() => {
    if (previousSearchTermRef.current !== debouncedSearchTerm) {
      setAllProducts([]);
      setHasMoreProducts(true);
      setIsLoadingMore(false);
      setCurrentPage(1);
      previousSearchTermRef.current = debouncedSearchTerm;
    }
  }, [debouncedSearchTerm]);

  // Search products query
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['searchProducts', debouncedSearchTerm, currentPage],
    queryFn: async (): Promise<Product[]> => {
      const response = await api.get('/woocom/test/search-products', {
        params: { q: debouncedSearchTerm, page: currentPage, per_page: 15 }
      });
      return response.data;
    },
    enabled: !!debouncedSearchTerm.trim() && debouncedSearchTerm.length >= 3,
    staleTime: 30000,
  });

  // Update allProducts when searchResults change
  useEffect(() => {
    if (searchResults) {
      if (currentPage === 1) {
        setAllProducts(searchResults);
      } else {
        setAllProducts(prev => [...prev, ...searchResults]);
      }
      
      setHasMoreProducts(searchResults.length === 15);
      setIsLoadingMore(false);
    }
  }, [searchResults, currentPage]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const handleIntersection = async (entries: IntersectionObserverEntry[]) => {
      if (entries[0].isIntersecting && hasMoreProducts && !isLoadingMore && debouncedSearchTerm.length > 3) {
        setIsLoadingMore(true);
        try {
          const response = await api.get('/woocom/test/search-products', {
            params: { q: debouncedSearchTerm, page: currentPage + 1, per_page: 15 }
          });
          
          const newProducts = response.data;
          if (newProducts.length === 0) {
            setHasMoreProducts(false);
          } else {
            setAllProducts(prev => [...prev, ...newProducts]);
            setCurrentPage(prev => prev + 1);
          }
        } catch (error) {
          console.error('Error loading more products:', error);
        } finally {
          setIsLoadingMore(false);
        }
      }
    };

    const observer = new IntersectionObserver(handleIntersection, { threshold: 0.1 });

    if (loaderRef.current && hasMoreProducts && allProducts.length > 0) {
      observer.observe(loaderRef.current);
    }

    return () => {
      if (loaderRef.current) {
        observer.unobserve(loaderRef.current);
      }
    };
  }, [hasMoreProducts, isLoadingMore, debouncedSearchTerm, allProducts.length, currentPage]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setDebouncedSearchTerm('');
      setAllProducts([]);
      setCurrentPage(1);
      setHasMoreProducts(true);
      setIsLoadingMore(false);
      previousSearchTermRef.current = '';
      
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Handle product selection
  const handleProductSelect = (product: Product) => {
    onProductSelect(product);
    onClose();
  };

  const formatCurrency = (amount: string | number) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return `৳${numAmount.toFixed(2)}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-gray-800 dark:to-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-600 rounded-lg">
                <Search className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Search Products</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Find and add products to the order</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        {/* Search Input */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search products by name, SKU, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-12 py-3 border border-green-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:text-white"
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-green-500" />
              </div>
            )}
          </div>
        </div>

        
        {/* Search Results */}
        <div className="p-6 max-h-96 overflow-y-auto" ref={scrollContainerRef}>
          {debouncedSearchTerm.length < 3 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Type at least 3 characters to search for products</p>
            </div>
          )}
          
          {debouncedSearchTerm.length >= 3 && isSearching && allProducts.length === 0 && (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="text-sm font-medium">Searching products...</span>
              </div>
            </div>
          )}
          
          {allProducts && allProducts.length > 0 && (
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900 dark:text-white">Found {allProducts.length} products{hasMoreProducts ? '+' : ''}:</h4>
              <div className="space-y-3">
                {allProducts.map((product) => (
                  <div
                    key={product.id}
                    onClick={() => handleProductSelect(product)}
                    className="group p-4 bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900 dark:to-green-800 rounded-lg border border-green-200 dark:border-green-700 hover:shadow-md cursor-pointer transition-all w-full"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-medium text-green-800 dark:text-green-200 mb-2">{product.name}</h4>
                        <div className="text-sm text-green-700 dark:text-green-300 space-y-1">
                          <div className="text-xs  text-green-800 dark:text-green-200">SKU: <span className="font-normal">{product.sku || 'N/A'}</span></div>
                          <div className="flex justify-between items-center mt-2">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                              product.stock_status === 'instock' 
                                ? 'bg-green-500 text-white'
                                : 'bg-red-500 text-white'
                            }`}>
                              {product.stock_status === 'instock' ? 'In Stock' : 'Out of Stock'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <p className="font-medium text-green-800 dark:text-green-200">
                          {formatCurrency(product.price)}
                        </p>
                        <div className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <span className="text-xs text-green-600 dark:text-green-400 font-medium">Click to add</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Infinite Scroll Loader */}
              {hasMoreProducts && allProducts.length > 0 && (
                <div ref={loaderRef} className="flex justify-center py-8">
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="text-sm font-medium">
                      {isLoadingMore ? 'Loading more products...' : 'Scroll to load more'}
                    </span>
                  </div>
                </div>
              )}
              
              {/* End of results indicator */}
              {!hasMoreProducts && allProducts.length > 0 && (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">No more products to load</p>
                </div>
              )}
            </div>
          )}
          
          {debouncedSearchTerm.length >= 3 && allProducts && allProducts.length === 0 && !isSearching && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No products found for your search</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductSearch; 