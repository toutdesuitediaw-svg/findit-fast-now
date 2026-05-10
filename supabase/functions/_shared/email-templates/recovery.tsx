/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

const LOGO_URL = 'https://yyendbkedzfnsmjiclhg.supabase.co/storage/v1/object/public/email-assets/logo.png'

export const RecoveryEmail = ({ siteName, confirmationUrl }: RecoveryEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Réinitialisez votre mot de passe {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}>
          <Img src={LOGO_URL} width="56" height="56" alt={siteName} style={logo} />
        </Section>
        <Heading style={h1}>Réinitialiser votre mot de passe</Heading>
        <Text style={text}>
          Nous avons reçu une demande de réinitialisation de votre mot de passe pour {siteName}.
          Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe.
        </Text>
        <Section style={btnSection}>
          <Button style={button} href={confirmationUrl}>
            Réinitialiser mon mot de passe
          </Button>
        </Section>
        <Hr style={hr} />
        <Text style={footer}>
          Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail. Votre mot de passe restera inchangé.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const logoSection = { textAlign: 'center' as const, margin: '0 0 24px' }
const logo = { borderRadius: '12px', display: 'inline-block' }
const h1 = {
  fontSize: '24px',
  fontWeight: 'bold' as const,
  color: '#0a0a0a',
  margin: '0 0 20px',
  textAlign: 'center' as const,
}
const text = { fontSize: '15px', color: '#55575d', lineHeight: '1.6', margin: '0 0 18px' }
const btnSection = { textAlign: 'center' as const, margin: '28px 0' }
const button = {
  backgroundColor: '#e8b94a',
  color: '#0a0a0a',
  fontSize: '15px',
  fontWeight: 'bold' as const,
  borderRadius: '12px',
  padding: '14px 28px',
  textDecoration: 'none',
  display: 'inline-block',
}
const hr = { borderColor: '#eeeeee', margin: '24px 0' }
const footer = { fontSize: '12px', color: '#999999', margin: '0', lineHeight: '1.5' }
