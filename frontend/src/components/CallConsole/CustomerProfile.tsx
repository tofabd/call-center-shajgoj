import React from 'react';
import { User } from 'lucide-react';

// WooCommerce Customer Interface
interface WooCommerceCustomer {
	id: number;
	date_created: string;
	date_created_gmt: string;
	date_modified: string;
	date_modified_gmt: string;
	email: string;
	first_name: string;
	last_name: string;
	role: string;
	username: string;
	billing: {
		first_name: string;
		last_name: string;
		company: string;
		address_1: string;
		address_2: string;
		city: string;
		state: string;
		postcode: string;
		country: string;
		email: string;
		phone: string;
	};
	shipping: {
		first_name: string;
		last_name: string;
		company: string;
		address_1: string;
		address_2: string;
		city: string;
		state: string;
		postcode: string;
		country: string;
	};
	is_paying_customer: boolean;
	avatar_url: string;
	meta_data: unknown[];
	_links: {
		self: { href: string }[];
		collection: { href: string }[];
	};
}

interface CustomerProfileProps {
	customers: WooCommerceCustomer[];
	selectedCustomer: WooCommerceCustomer | null;
	selectedCallId: number | null;
	selectedPhoneNumber: string | null;
	customersQuery: {
		data: { data: WooCommerceCustomer[]; message: string; success: boolean } | undefined;
		isLoading: boolean;
		isError: boolean;
		error?: { message?: string } | null;
		refetch: () => void;
	};
}

// Utility function to format date and time
const formatDateTime = (dateString: string): string => {
	const date = new Date(dateString);
	return date.toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
};

const CustomerProfile: React.FC<CustomerProfileProps> = ({
	selectedCallId,
	selectedPhoneNumber,
	customersQuery,
	customers,
	selectedCustomer
}) => {
	return (
		<div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
			<div className="flex items-center space-x-3 mb-6">
				<div className="p-2 bg-green-600 rounded-lg">
					<User className="h-5 w-5 text-white" />
				</div>
				<h3 className="text-lg font-semibold text-gray-900 dark:text-white">Customer Profile</h3>
			</div>
			
			{!selectedCallId ? (
				<div className="text-center py-8">
					<div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
						<User className="h-8 w-8 text-gray-400" />
					</div>
					<p className="text-gray-500 dark:text-gray-400 text-sm">Select a call to view customer profile</p>
				</div>
			) : customersQuery.isLoading ? (
				<div className="space-y-4">
					{[...Array(4)].map((_, i) => (
						<div key={i} className="animate-pulse">
							<div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
							<div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
						</div>
					))}
				</div>
			) : customersQuery.isError && !customersQuery.data ? (
				<div className="p-8 flex items-center justify-center h-full">
					<div className="text-center">
						<div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-4">
							<User className="h-8 w-8 text-red-600 dark:text-red-400" />
						</div>
						<p className="text-red-600 dark:text-red-400 text-sm font-medium">
							{customersQuery.error?.message || 'Failed to load customer data'}
						</p>
						<p className="text-gray-500 dark:text-gray-400 text-xs mt-1">Unable to fetch customer information for this phone number</p>
					</div>
				</div>
			) : customers.length === 0 ? (
				<div className="p-8 flex items-center justify-center h-full">
					<div className="text-center">
						<div className="w-20 h-20 bg-green-100 dark:bg-green-700 rounded-full flex items-center justify-center mx-auto mb-6">
							<User className="h-10 w-10 text-green-400" />
						</div>
						<h4 className="text-gray-900 dark:text-white font-medium text-lg mb-2">No Customer Found</h4>
						<p className="text-gray-500 dark:text-gray-400 mb-4">{customersQuery.data?.message || 'No customer found for this phone number'}</p>
						{/* Customer creation and editing removed */}
					</div>
				</div>
			) : (
				<div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
					<p className="text-sm text-gray-900 dark:text-white">
						Customer data is not connected. Phone: <span className="font-mono">{selectedPhoneNumber || '-'}</span>
					</p>
					{selectedCustomer && (
						<p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Last seen customer record: {formatDateTime(selectedCustomer.date_created)}</p>
					)}
				</div>
			)}
		</div>
	);
};

export default CustomerProfile;