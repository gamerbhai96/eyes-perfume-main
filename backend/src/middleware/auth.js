import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

export function authenticateToken(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({ error: 'No authorization header' });
        }

        const token = authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (err) {
                console.error('❌ JWT Error:', err.message);
                return res.status(403).json({ error: 'Invalid or expired token' });
            }

            req.user = user;
            next();
        });
    } catch (error) {
        console.error('❌ Auth middleware error:', error);
        return res.status(500).json({ error: 'Authentication error' });
    }
}

export function requireAdmin(req, res, next) {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Admin only' });
    }
    next();
}
