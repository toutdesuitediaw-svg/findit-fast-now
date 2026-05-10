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
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface EmailChangeEmailProps {
  siteName: string
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

const LOGO_URL = 'https://yyendbkedzfnsmjiclhg.supabase.co/storage/v1/object/public/email-assets/logo.png'

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Confirmez le changement d'e-mail pour {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}>
          <Img src={LOGO_URL} width="56" height="56" alt={siteName} style={logo} />
        </Section>
        <Heading style={h1}>Confirmez le changement d'e-mail</Heading>
        <Text style={text}>
          Vous avez demandé à changer votre adresse e-mail sur {siteName} de{' '}
          <Link href={`mailto:${oldEmail}`} style={link}>{oldEmail}</Link>{' '}
          vers{' '}
          <Link href={`mailto:${newEmail}`} style={link}>{newEmail}</Link>.
        </Text>
        <Text style={text}>Cliquez sur le bouton ci-dessous pour confirmer ce changement :</Text>
        <Section style={btnSection}>
          <Button style={button} href={confirmationUrl}>
            Confirmer le changement
          </Button>
        </Section>
        <Hr style={hr} />
        <Text style={footer}>
          Si vous n'êtes pas à l'origine de cette demande, sécurisez votre compte immédiatement.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail

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
const link = { color: '#b8860b', textDecoration: 'underline' }
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
