import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <SignUp
      fallbackRedirectUrl="/account"
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
