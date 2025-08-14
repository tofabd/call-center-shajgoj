<?php

namespace App\Services;

use App\Services\ExternalApiService;
use Illuminate\Support\Facades\Log;

class CustomerService
{
    private $externalApiService;

    public function __construct(ExternalApiService $externalApiService)
    {
        $this->externalApiService = $externalApiService;
    }

    /**
     * Get customer list from external CRM API
     *
     * @param array $params
     * @return array
     * @throws \Exception
     */
    public function getCustomerList(array $params = []): array
    {
        try {
            // Prepare parameters for the external API
            $apiParams = [
                'page' => $params['page'] ?? 1,
                'order_by' => $params['order_by'] ?? 'asc',
                'per_page' => $params['per_page'] ?? 50,
            ];

            // Add search parameter if provided
            if (!empty($params['search'])) {
                $apiParams['search'] = $params['search'];
            }

            // Call the external API using the correct customer-list endpoint
            // The ExternalApiService will automatically:
            // 1. Get base_url from database
            // 2. Get access_token from database
            // 3. Add Bearer token to Authorization header
            // Final URL: {base_url}/crm/customer-list?page=1&order_by=asc
            $response = $this->externalApiService->getData('/crm/customer-list', $apiParams);

            // The external API returns pagination data directly
            // We need to ensure it has the required pagination fields
            if (!isset($response['current_page'])) {
                throw new \Exception('Invalid response format from external API');
            }

            // Calculate total pages if not provided
            if (!isset($response['last_page']) && isset($response['total']) && isset($response['per_page'])) {
                $response['last_page'] = (int) ceil($response['total'] / $response['per_page']);
            }

            // Ensure total is set
            if (!isset($response['total']) && isset($response['to'])) {
                $response['total'] = $response['to'];
            }

            return $response;
        } catch (\Exception $e) {
            throw new \Exception('Failed to fetch customer list from external API: ' . $e->getMessage());
        }
    }

    /**
     * Get customer orders by phone number from external CRM API
     *
     * @param string $phoneNumber
     * @return array
     * @throws \Exception
     */
    public function getCustomerOrders(string $phoneNumber): array
    {
        try {
            // Remove +88 prefix if present
            $cleanPhoneNumber = $phoneNumber;
            if (str_starts_with($phoneNumber, '+88')) {
                $cleanPhoneNumber = substr($phoneNumber, 3);
            }

            Log::info('Fetching customer orders', [
                'original_phone' => $phoneNumber,
                'clean_phone' => $cleanPhoneNumber,
                'endpoint' => '/crm/customer-orders/' . $cleanPhoneNumber
            ]);

            // Call the external API using the customer-orders endpoint
            // Final URL: {base_url}/crm/customer-orders/{phoneNumber}
            $response = $this->externalApiService->getData('/crm/customer-orders/' . $cleanPhoneNumber);

            Log::info('Customer orders fetched successfully', [
                'phone_number' => $cleanPhoneNumber,
                'orders_count' => isset($response['data']) ? count($response['data']) : 0,
                'response_message' => $response['message'] ?? 'No message',
                'response_structure' => [
                    'has_data_key' => isset($response['data']),
                    'has_message_key' => isset($response['message']),
                    'response_keys' => array_keys($response),
                    'first_order_sample' => isset($response['data'][0]) ? array_keys($response['data'][0]) : 'No orders'
                ]
            ]);

            // Return the response data
            return $response;
        } catch (\Exception $e) {
            Log::error('Failed to fetch customer orders', [
                'phone_number' => $phoneNumber,
                'error' => $e->getMessage()
            ]);
            throw new \Exception('Failed to fetch customer orders from external API: ' . $e->getMessage());
        }
    }

    /**
     * Get base URL from the environment configuration
     *
     * @return string|null
     */
    public function getBaseUrl(): ?string
    {
        try {
            return $this->externalApiService->getBaseUrl();
        } catch (\Exception $e) {
            Log::error('Failed to get base URL from environment', ['error' => $e->getMessage()]);
            return null;
        }
    }
}
