import { KycStatus } from '@fiatconnect/fiatconnect-types'
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm'
import { KycSchema } from '../types'

@Entity()
export class KYC {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ name: 'kycRequired', type: 'bool' })
  kycRequired: boolean

  @Column({
    name: 'kycSchemaName',
    type: 'enum',
    enum: KycSchema,
  })
  kycSchemaName?: KycSchema

  @Column({
    name: 'status',
    type: 'enum',
    enum: KycStatus,
  })
  status?: KycStatus

  @Column({ type: 'varchar', length: 255, nullable: true })
  owner?: string

  @Column({ type: 'varchar', length: 255 })
  firstName: string
  @Column({ type: 'varchar', length: 255 })
  middleName?: string
  @Column({ type: 'varchar', length: 255 })
  lastName: string
  @Column('simple-json')
  dateOfBirth: {
    day: string
    month: string
    year: string
  }

  @Column('simple-json')
  address: {
    address1: string
    address2?: string
    isoCountryCode: string
    isoRegionCode: string
    city: string
    postalCode?: string
  }
  @Column({ type: 'varchar', length: 255 })
  phoneNumber: string
  @Column({ type: 'varchar', length: 255 })
  selfieDocument: string
  @Column({ type: 'varchar', length: 255 })
  identificationDocument: string
}
