import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import db from './database.js';
import dotenv from 'dotenv';
import { saveAccountToFile } from './storageService.js';

dotenv.config();

// Sérialisation de l'utilisateur
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Désérialisation de l'utilisateur
passport.deserializeUser((id, done) => {
  const user = db.prepare('SELECT * FROM patients WHERE id = ?').get(id);
  done(null, user);
});

// Configuration Google OAuth
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== 'your_google_client_id') {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.BACKEND_URL}/api/auth/google/callback`
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Chercher si l'utilisateur existe déjà
      let user = db.prepare('SELECT * FROM patients WHERE google_id = ?').get(profile.id);

      if (!user) {
        // Vérifier si l'email existe déjà
        user = db.prepare('SELECT * FROM patients WHERE email = ?').get(profile.emails[0].value);

        if (user) {
          // Mettre à jour avec le google_id
          db.prepare('UPDATE patients SET google_id = ?, is_verified = 1 WHERE id = ?')
            .run(profile.id, user.id);
          user.google_id = profile.id;
          user.is_verified = 1;
        } else {
          // Créer un nouvel utilisateur
          const result = db.prepare(`
            INSERT INTO patients (email, name, google_id, is_verified)
            VALUES (?, ?, ?, 1)
          `).run(
            profile.emails[0].value,
            profile.displayName,
            profile.id
          );

          user = db.prepare('SELECT * FROM patients WHERE id = ?').get(result.lastInsertRowid);
        }
      }

      // Sauvegarde dans le dossier temporaire
      saveAccountToFile({ ...user, password: '[OAUTH_GOOGLE]', status: 'verified_google' });

      return done(null, user);
    } catch (error) {
      return done(error, null);
    }
  }));
}

// Configuration Facebook OAuth
if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_ID !== 'your_facebook_app_id') {
  passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: `${process.env.BACKEND_URL}/api/auth/facebook/callback`,
    profileFields: ['id', 'emails', 'name']
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Chercher si l'utilisateur existe déjà
      let user = db.prepare('SELECT * FROM patients WHERE facebook_id = ?').get(profile.id);

      if (!user) {
        // Vérifier si l'email existe déjà
        const email = profile.emails && profile.emails[0] ? profile.emails[0].value : `${profile.id}@facebook.com`;
        user = db.prepare('SELECT * FROM patients WHERE email = ?').get(email);

        if (user) {
          // Mettre à jour avec le facebook_id
          db.prepare('UPDATE patients SET facebook_id = ?, is_verified = 1 WHERE id = ?')
            .run(profile.id, user.id);
          user.facebook_id = profile.id;
          user.is_verified = 1;
        } else {
          // Créer un nouvel utilisateur
          const name = profile.name ? `${profile.name.givenName} ${profile.name.familyName}` : 'Utilisateur Facebook';
          const result = db.prepare(`
            INSERT INTO patients (email, name, facebook_id, is_verified)
            VALUES (?, ?, ?, 1)
          `).run(email, name, profile.id);

          user = db.prepare('SELECT * FROM patients WHERE id = ?').get(result.lastInsertRowid);
        }
      }

      // Sauvegarde dans le dossier temporaire
      saveAccountToFile({ ...user, password: '[OAUTH_FACEBOOK]', status: 'verified_facebook' });

      return done(null, user);
    } catch (error) {
      return done(error, null);
    }
  }));
}

export default passport;
