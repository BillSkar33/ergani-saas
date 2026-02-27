/**
 * ============================================================
 * ΨΗΦΙΑΚΗ ΚΑΡΤΑ ΕΡΓΑΣΙΑΣ — SaaS Platform
 * Αλγόριθμος Haversine — Υπολογισμός Γεωγραφικής Απόστασης
 * 
 * Ο αλγόριθμος Haversine υπολογίζει την απόσταση μεταξύ δύο
 * σημείων στην επιφάνεια της Γης (great-circle distance),
 * λαμβάνοντας υπόψη τη σφαιρικότητα του πλανήτη.
 * 
 * Ακρίβεια: ~0.5% error (αρκετή για geofencing σε μέτρα)
 * ============================================================
 */

'use strict';

// Ακτίνα Γης σε μέτρα (μέση τιμή WGS-84)
const EARTH_RADIUS_METERS = 6371000;

/**
 * Μετατροπή μοιρών σε ακτίνια (radians)
 * 
 * Απαραίτητη μετατροπή γιατί οι τριγωνομετρικές συναρτήσεις
 * (Math.sin, Math.cos) δέχονται ακτίνια, όχι μοίρες.
 * 
 * @param {number} degrees - Τιμή σε μοίρες (π.χ. 37.9838)
 * @returns {number} - Τιμή σε ακτίνια
 */
function toRadians(degrees) {
    return degrees * (Math.PI / 180);
}

/**
 * Υπολογισμός απόστασης Haversine μεταξύ δύο GPS σημείων
 * 
 * Μαθηματικός τύπος:
 * a = sin²(Δφ/2) + cos(φ₁) × cos(φ₂) × sin²(Δλ/2)
 * c = 2 × atan2(√a, √(1−a))
 * d = R × c
 * 
 * Όπου:
 * - φ = γεωγραφικό πλάτος (latitude)
 * - λ = γεωγραφικό μήκος (longitude)  
 * - R = ακτίνα Γης
 * - Δφ = διαφορά πλάτους
 * - Δλ = διαφορά μήκους
 * 
 * @param {number} lat1 - Γεωγραφικό πλάτος σημείου Α (μοίρες)
 * @param {number} lon1 - Γεωγραφικό μήκος σημείου Α (μοίρες)
 * @param {number} lat2 - Γεωγραφικό πλάτος σημείου Β (μοίρες)
 * @param {number} lon2 - Γεωγραφικό μήκος σημείου Β (μοίρες)
 * @returns {number} - Απόσταση σε μέτρα (ακέραια)
 * 
 * @example
 * // Απόσταση μεταξύ δύο σημείων στην Αθήνα
 * const distance = haversine(37.9838, 23.7275, 37.9850, 23.7290);
 * console.log(distance); // ~173 μέτρα
 */
function haversine(lat1, lon1, lat2, lon2) {
    // Μετατροπή όλων των συντεταγμένων σε ακτίνια
    const φ1 = toRadians(lat1);   // Πλάτος σημείου Α
    const φ2 = toRadians(lat2);   // Πλάτος σημείου Β
    const Δφ = toRadians(lat2 - lat1);   // Διαφορά πλάτους
    const Δλ = toRadians(lon2 - lon1);   // Διαφορά μήκους

    // Υπολογισμός Haversine formula
    // a = sin²(Δφ/2) + cos(φ₁) × cos(φ₂) × sin²(Δλ/2)
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

    // c = 2 × atan2(√a, √(1−a)) — κεντρική γωνία
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    // d = R × c — απόσταση σε μέτρα
    const distance = EARTH_RADIUS_METERS * c;

    // Στρογγυλοποίηση σε 2 δεκαδικά (ακρίβεια εκατοστά μέτρου)
    return Math.round(distance * 100) / 100;
}

module.exports = { haversine, toRadians, EARTH_RADIUS_METERS };
