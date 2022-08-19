import { TransferStatus } from '@fiatconnect/fiatconnect-types'
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm'

@Entity()
export class Transfer {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'fiatAccountId', type: 'numeric' })
  fiatAccountId: number

  @Column({ name: 'quoteId', type: 'numeric' })
  quoteId: number

  @Column({ type: 'varchar', length: 255 })
  transferAddress?: string

  @Column({
    name: 'transferStatus',
    type: 'enum',
    enum: TransferStatus,
  })
  status?: TransferStatus
}
