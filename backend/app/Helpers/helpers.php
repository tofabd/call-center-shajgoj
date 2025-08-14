<?php

if (!function_exists('format_phone')) {
    /**
     * Format a phone number by removing non-numeric characters and optional country code
     *
     * @param string $phoneNumber The phone number to format
     * @return string The formatted phone number
     */
    function format_phone(string $phoneNumber): string
    {
        // Remove +88 prefix only if it's at the beginning of the phone number
        $phoneNumber = preg_replace('/^\+88/', '', $phoneNumber);
        
        // Remove all non-numeric characters
        return preg_replace('/[^0-9]/', '', $phoneNumber);
    }
}
