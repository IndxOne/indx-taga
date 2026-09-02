import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ClientRideMap from './ClientRideMap'

describe('ClientRideMap', () => {
  it('ne montre pas le chauffeur avant attribution', () => {
    render(<ClientRideMap phase="active" />)

    expect(screen.queryByText('Mamadou · 3 min')).toBeNull()
  })

  it('montre le chauffeur après attribution', () => {
    render(<ClientRideMap phase="active" showDriver />)

    expect(screen.queryByText('Mamadou · 3 min')).not.toBeNull()
  })
})
