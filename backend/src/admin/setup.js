import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import * as AdminJSMongoose from '@adminjs/mongoose';
import { User, Product, Cart, Order, Review } from '../models/index.js';

// Register Mongoose adapter
AdminJS.registerAdapter({
    Resource: AdminJSMongoose.Resource,
    Database: AdminJSMongoose.Database,
});

export function setupAdminJS(app) {
    const admin = new AdminJS({
        resources: [User, Product, Order, Cart, Review],
        rootPath: '/admin',
        branding: {
            companyName: 'EYES Perfume Admin',
            logo: false,
            softwareBrothers: false,
        },
    });

    const adminRouter = AdminJSExpress.buildAuthenticatedRouter(
        admin,
        {
            authenticate: async (email, password) => {
                if (
                    email === process.env.ADMIN_EMAIL &&
                    password === process.env.ADMIN_PASSWORD
                ) {
                    console.log('✅ Admin login success');
                    return { email };
                }
                return null;
            },
            cookieName: 'adminjs',
            cookiePassword: 'skip-cookie',
        },
        null,
        {
            resave: false,
            saveUninitialized: false,
        }
    );

    app.use(admin.options.rootPath, adminRouter);

    return admin;
}
