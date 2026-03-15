import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <SignIn
      fallbackRedirectUrl="/dashboard"
      appearance={{
        variables: {
          borderRadius: '16px',
          fontFamily: 'inherit',
        },
        elements: {
          card: {
            background: 'transparent',
            boxShadow: 'none',
            border: 'none',
            padding: '0',
          },
          cardBox: {
            width: '100%',
          },
        },
      }}
    />
  )
}
