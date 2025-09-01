import AsteriskManager from 'asterisk-manager';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

console.log('🔍 DND Detection via Call Pattern Analysis');
console.log('==========================================');

const amiConfig = {
    host: process.env.AMI_HOST,
    port: process.env.AMI_PORT,
    username: process.env.AMI_USERNAME,
    password: process.env.AMI_PASSWORD,
    events: 'on'
};

const manager = new AsteriskManager(
    amiConfig.port,
    amiConfig.host,
    amiConfig.username,
    amiConfig.password,
    true
);

// Track call patterns for DND inference
const extensionStats = new Map();
const DND_INDICATORS = {
    CONSECUTIVE_BUSY: 3,      // 3+ consecutive BUSY responses
    QUICK_FORWARD: 5000,      // Calls forwarded in <5 seconds
    NO_ANSWER_PATTERN: 2,     // 2+ consecutive NO_ANSWER
    RING_TIME_THRESHOLD: 3000 // Rings less than 3 seconds
};

function updateExtensionStats(extension, event, data = {}) {
    if (!extensionStats.has(extension)) {
        extensionStats.set(extension, {
            extension,
            consecutiveBusy: 0,
            consecutiveNoAnswer: 0,
            lastCallTime: null,
            quickForwards: 0,
            avgRingTime: 0,
            totalCalls: 0,
            suspectedDND: false,
            confidence: 0,
            lastActivity: new Date()
        });
    }
    
    const stats = extensionStats.get(extension);
    stats.lastActivity = new Date();
    
    switch(event) {
        case 'BUSY':
            stats.consecutiveBusy++;
            stats.consecutiveNoAnswer = 0;
            break;
            
        case 'NO_ANSWER':
            stats.consecutiveNoAnswer++;
            stats.consecutiveBusy = 0;
            break;
            
        case 'ANSWERED':
            stats.consecutiveBusy = 0;
            stats.consecutiveNoAnswer = 0;
            stats.totalCalls++;
            break;
            
        case 'FORWARDED':
            if (data.ringTime && data.ringTime < DND_INDICATORS.QUICK_FORWARD) {
                stats.quickForwards++;
            }
            break;
    }
    
    // Calculate DND probability
    calculateDNDProbability(extension);
}

function calculateDNDProbability(extension) {
    const stats = extensionStats.get(extension);
    let confidence = 0;
    
    // Pattern analysis
    if (stats.consecutiveBusy >= DND_INDICATORS.CONSECUTIVE_BUSY) {
        confidence += 40;
    }
    
    if (stats.consecutiveNoAnswer >= DND_INDICATORS.NO_ANSWER_PATTERN) {
        confidence += 30;
    }
    
    if (stats.quickForwards > 0) {
        confidence += 20;
    }
    
    if (stats.avgRingTime > 0 && stats.avgRingTime < DND_INDICATORS.RING_TIME_THRESHOLD) {
        confidence += 10;
    }
    
    stats.confidence = Math.min(confidence, 100);
    stats.suspectedDND = confidence > 50;
    
    if (stats.suspectedDND && confidence > 70) {
        console.log(`🚫 HIGH DND Probability: ${extension} (${confidence}%)`);
    }
}

manager.on('connect', function() {
    console.log('✅ Connected to AMI for DND pattern monitoring');
    console.log('📊 Monitoring call patterns for DND inference...\n');
});

// Monitor various AMI events for DND patterns
manager.on('newchannel', function(evt) {
    const extension = extractExtension(evt.channel);
    if (extension) {
        updateExtensionStats(extension, 'NEW_CALL', {
            callId: evt.uniqueid,
            timestamp: new Date()
        });
    }
});

manager.on('hangup', function(evt) {
    const extension = extractExtension(evt.channel);
    if (extension && evt.cause) {
        let event = 'HANGUP';
        
        // Map hangup causes to DND indicators
        switch(evt.cause) {
            case '17': // User busy
            case '21': // Call rejected
                event = 'BUSY';
                break;
            case '19': // No answer
            case '18': // No user responding
                event = 'NO_ANSWER';
                break;
            case '16': // Normal clearing (answered)
                event = 'ANSWERED';
                break;
        }
        
        updateExtensionStats(extension, event);
    }
});

manager.on('dial', function(evt) {
    const extension = extractExtension(evt.destination);
    if (extension && evt.subevent === 'Begin') {
        // Track call forwarding patterns
        if (evt.destination !== evt.channel) {
            updateExtensionStats(extension, 'FORWARDED', {
                ringTime: Date.now() - (evt.timestamp || Date.now())
            });
        }
    }
});

// Check Asterisk database for DND settings
function checkAsteriskDB() {
    manager.action({
        'action': 'DBGet',
        'family': 'DND'
    }, function(err, res) {
        if (!err && res) {
            console.log('📋 Found DND entries in AstDB:', res);
        }
    });
    
    // Also check for custom DND family
    manager.action({
        'action': 'DBGet', 
        'family': 'CF',  // Call Forward
        'key': 'DND'
    }, function(err, res) {
        if (!err && res) {
            console.log('📋 Found Call Forward DND entries:', res);
        }
    });
}

function extractExtension(channel) {
    if (!channel) return null;
    
    // Extract extension from SIP/1001-xxxxx format
    const match = channel.match(/SIP\/(\d{3,5})/);
    return match ? match[1] : null;
}

function generateReport() {
    const report = {
        timestamp: new Date().toISOString(),
        totalExtensions: extensionStats.size,
        suspectedDND: [],
        statistics: {}
    };
    
    console.log('\n🔍 DND Detection Report');
    console.log('======================');
    
    extensionStats.forEach((stats, extension) => {
        if (stats.suspectedDND) {
            report.suspectedDND.push(stats);
            console.log(`🚫 Extension ${extension}: ${stats.confidence}% DND probability`);
            console.log(`   - Consecutive Busy: ${stats.consecutiveBusy}`);
            console.log(`   - Consecutive No Answer: ${stats.consecutiveNoAnswer}`);
            console.log(`   - Quick Forwards: ${stats.quickForwards}`);
        }
    });
    
    if (report.suspectedDND.length === 0) {
        console.log('✅ No extensions showing strong DND patterns');
    }
    
    // Save report to organized debug folder
    const debugDir = path.join(__dirname, '../debug/dndTracker');
    if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
    }
    
    const fileName = `dndTracker-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const filePath = path.join(debugDir, fileName);
    
    try {
        fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
        console.log(`\n💾 DND analysis saved to: ${fileName}`);
    } catch (error) {
        console.error('❌ Error saving report:', error.message);
    }
}

// Periodic reporting
setInterval(generateReport, 30000); // Every 30 seconds

// Check AstDB on startup
manager.on('connect', function() {
    setTimeout(checkAsteriskDB, 2000);
});

manager.on('error', function(err) {
    console.error('❌ AMI Error:', err.message);
});

// Graceful shutdown
process.on('SIGINT', function() {
    console.log('\n⚠️  Generating final report...');
    generateReport();
    manager.disconnect();
    process.exit(0);
});

console.log('🔍 Starting DND pattern monitoring...');
manager.connect();