import {
  FeeFrequency,
  FeeType,
  FiatAccountSchema,
  FiatAccountType,
  SupportedOperatorEnum,
} from '@fiatconnect/fiatconnect-types'
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm'

@Entity()
export class Account {
  @PrimaryGeneratedColumn()
  id: number

  @Column({
    name: 'operator',
    type: 'enum',
    enum: SupportedOperatorEnum,
  })
  operator?: SupportedOperatorEnum
  @Column({ name: 'institutionName', type: 'varchar', length: 255 })
  institutionName: string
  @Column({ name: 'accountName', type: 'varchar', length: 255 })
  accountName: string
  @Column({ name: 'mobile', type: 'varchar', length: 255 })
  mobile?: string
  @Column({ name: 'country', type: 'varchar', length: 255 })
  country: string
  @Column({ name: 'accountNumber', type: 'varchar', length: 255 })
  accountNumber?: string
  @Column({
    name: 'fiatAccountType',
    type: 'enum',
    enum: FiatAccountType,
  })
  @Column({ name: 'owner', type: 'varchar', length: 255 })
  owner: string
  fiatAccountType: FiatAccountType
  @Column({
    name: 'fiatAccountSchema',
    type: 'enum',
    enum: FiatAccountSchema,
  })
  fiatAccountSchema: FiatAccountSchema
}
