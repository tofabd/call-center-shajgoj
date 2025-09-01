import AsteriskManager from 'asterisk-manager';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

console.log('🔍 DeviceState Query Script Starting...');
console.log('=====================================');

// AMI Configuration
const amiConfig = {
    host: process.env.AMI_HOST,
    port: process.env.AMI_PORT,
    username: process.env.AMI_USERNAME,
    password: process.env.AMI_PASSWORD,
    events: 'on'
};

console.log(`📡 Connecting to AMI: ${amiConfig.host}:${amiConfig.port}`);
console.log(`👤 Username: ${amiConfig.username}`);

const manager = new AsteriskManager(
    amiConfig.port,
    amiConfig.host,
    amiConfig.username,
    amiConfig.password,
    true
);

// Device states mapping
const deviceStates = {
    0: 'UNKNOWN',
    1: 'NOT_INUSE',
    2: 'INUSE', 
    3: 'BUSY',
    4: 'INVALID',
    5: 'UNAVAILABLE',
    6: 'RINGING',
    7: 'RINGINUSE',
    8: 'ONHOLD',
    // String versions
    'UNKNOWN': 'UNKNOWN',
    'NOT_INUSE': 'NOT_INUSE',
    'INUSE': 'INUSE',
    'BUSY': 'BUSY',
    'INVALID': 'INVALID',
    'UNAVAILABLE': 'UNAVAILABLE',
    'RINGING': 'RINGING',
    'RINGINUSE': 'RINGINUSE',
    'ONHOLD': 'ONHOLD'
};

let deviceStateData = [];
let isCollecting = false;

manager.on('connect', function() {
    console.log('✅ Connected to AMI successfully');
    console.log('📊 Querying DeviceStateList...');
    
    isCollecting = true;
    deviceStateData = [];
    
    // Query DeviceStateList
    manager.action({
        'action': 'DeviceStateList'
    }, function(err, res) {
        if (err) {
            console.error('❌ Error querying DeviceStateList:', err);
            process.exit(1);
        }
        console.log('📡 DeviceStateList query sent, waiting for responses...');
    });
});

manager.on('devicestatechange', function(evt) {
    if (isCollecting) {
        const deviceInfo = {
            device: evt.device,
            state: evt.state,
            stateName: deviceStates[evt.state] || evt.state,
            timestamp: new Date().toISOString()
        };
        
        deviceStateData.push(deviceInfo);
        console.log(`📱 Device: ${evt.device} | State: ${evt.state} (${deviceStates[evt.state] || evt.state})`);
    }
});

manager.on('devicestatelist', function(evt) {
    if (isCollecting) {
        const deviceInfo = {
            device: evt.device,
            state: evt.state,
            stateName: deviceStates[evt.state] || evt.state,
            timestamp: new Date().toISOString()
        };
        
        deviceStateData.push(deviceInfo);
        console.log(`📱 Device: ${evt.device} | State: ${evt.state} (${deviceStates[evt.state] || evt.state})`);
    }
});

manager.on('devicestatelistcomplete', function(evt) {
    console.log('=====================================');
    console.log('✅ DeviceStateList query completed');
    console.log(`📊 Total devices found: ${deviceStateData.length}`);
    
    // Sort by device name
    deviceStateData.sort((a, b) => a.device.localeCompare(b.device));
    
    // Display summary
    console.log('\n📈 Device State Summary:');
    console.log('========================');
    
    const stateCounts = {};
    deviceStateData.forEach(device => {
        const stateName = device.stateName;
        stateCounts[stateName] = (stateCounts[stateName] || 0) + 1;
    });
    
    Object.keys(stateCounts).forEach(state => {
        console.log(`${state}: ${stateCounts[state]} devices`);
    });
    
    // Filter interesting states (extensions only)
    const extensions = deviceStateData.filter(device => 
        device.device.includes('SIP/') && 
        /SIP\/\d{3,5}/.test(device.device)
    );
    
    console.log(`\n🔌 SIP Extensions found: ${extensions.length}`);
    
    // Show DND/BUSY extensions
    const busyExtensions = extensions.filter(ext => 
        ext.stateName === 'BUSY' || ext.stateName === 'UNAVAILABLE'
    );
    
    if (busyExtensions.length > 0) {
        console.log('\n🚫 Extensions in DND/BUSY state:');
        busyExtensions.forEach(ext => {
            console.log(`   ${ext.device} - ${ext.stateName}`);
        });
    }
    
    // Create output object
    const outputData = {
        timestamp: new Date().toISOString(),
        totalDevices: deviceStateData.length,
        extensionCount: extensions.length,
        stateSummary: stateCounts,
        busyExtensions: busyExtensions.length,
        devices: deviceStateData,
        extensions: extensions
    };
    
    // Save to JSON file
    const fileName = `device-states-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const filePath = path.join(__dirname, fileName);
    
    try {
        fs.writeFileSync(filePath, JSON.stringify(outputData, null, 2));
        console.log(`\n💾 Data saved to: ${fileName}`);
        console.log(`📁 Full path: ${filePath}`);
    } catch (error) {
        console.error('❌ Error saving JSON file:', error.message);
    }
    
    // Cleanup and exit
    setTimeout(() => {
        manager.disconnect();
        console.log('\n👋 Disconnected from AMI');
        process.exit(0);
    }, 1000);
});

manager.on('error', function(err) {
    console.error('❌ AMI Connection Error:', err.message);
    process.exit(1);
});

manager.on('disconnect', function() {
    console.log('🔌 Disconnected from AMI');
});

// Handle script termination
process.on('SIGINT', function() {
    console.log('\n⚠️  Script interrupted by user');
    manager.disconnect();
    process.exit(0);
});

process.on('uncaughtException', function(err) {
    console.error('❌ Uncaught Exception:', err.message);
    manager.disconnect();
    process.exit(1);
});

// Connect to AMI
manager.connect();