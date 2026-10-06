import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDashboardRead } from '../../hooks/useDashboardRead'
import { DashboardInbox, InboxCategory, InboxItem } from '../../types/dashboard'
import { dashboardHref } from '../../utils/dashboard'
import { api, getErrorMessage } from '../../services/api'
import { journalApi } from '../../services/journal'
import { shopApi } from '../../services/shop'
import { Button, TextArea, useToast } from '../ui'
import DashboardSection, { OffsetNavigation } from './DashboardSection'
import JournalReviewDialog from './JournalReviewDialog'

const categories: { value: Exclude<InboxCategory, 'all'>; label: string }[] = [
  { value: 'journals', label: 'Journal reviews' },
  { value: 'approvals', label: 'Shop approvals' },
  { value: 'pickups', label: 'Rewards awaiting pickup' },
  { value: 'help', label: 'Student help requests' },
]
export default function TeacherInbox({
  studentId,
  category,
  onCategory,
  version,
  refresh,
  pointsEnabled,
}: {
  studentId: number | null
  category: InboxCategory
  onCategory: (category: InboxCategory) => void
  version: number
  refresh: () => void
  pointsEnabled: boolean
}) {
  const [navigation, setNavigation] = useState({ key: '', offset: 0 })
  const key = `${studentId}:${category}`
  const offset = navigation.key === key ? navigation.offset : 0
  const read = useDashboardRead<DashboardInbox>(
    '/dashboard/teacher/inbox',
    { student_id: studentId, category, offset, limit: 10 },
    version,
  )
  const [busy, setBusy] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [expanded, setExpanded] = useState<string | null>(null)
  const [journalId, setJournalId] = useState<number | null>(null)
  const { toast } = useToast()
  const action = async (itemKey: string, run: () => Promise<unknown>) => {
    if (busy !== null) return
    setBusy(itemKey)
    setErrors((prev) => ({ ...prev, [itemKey]: '' }))
    try {
      await run()
      setDrafts((prev) => ({ ...prev, [itemKey]: '' }))
      refresh()
      toast('Request updated.')
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        [itemKey]: getErrorMessage(err, 'Could not update this request.'),
      }))
    } finally {
      setBusy(null)
    }
  }
  const renderItem = (item: InboxItem, type: Exclude<InboxCategory, 'all'>) => {
    const itemKey = `${type}:${item.id}`
    const draft = drafts[itemKey] ?? ''
    return (
      <li
        key={itemKey}
        className="border border-line rounded-field p-3 space-y-2"
      >
        <div>
          <p className="text-xs text-muted">
            {item.student_name} ·{' '}
            {new Date(item.created_at).toLocaleDateString()}
          </p>
          <p className="font-semibold text-sm break-words">{item.title}</p>
        </div>
        {item.preview && (
          <p className="text-sm text-ink-2 break-words line-clamp-3">
            {item.preview.replace(/<[^>]*>/g, '')}
          </p>
        )}
        {item.cost_points != null && (
          <p className="text-sm">{item.cost_points.toLocaleString()} points</p>
        )}
        {item.pickup_instructions && (
          <p className="text-sm break-words">
            Pickup: {item.pickup_instructions}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {type === 'journals' && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setJournalId(item.id)}
              >
                Read & reply
              </Button>
              <Button
                size="sm"
                disabled={busy !== null}
                loading={busy === itemKey}
                onClick={() =>
                  void action(itemKey, () => journalApi.markRead(item.id))
                }
              >
                Mark reviewed
              </Button>
            </>
          )}
          {type === 'approvals' && (
            <>
              <Button
                size="sm"
                loading={busy === itemKey}
                disabled={busy !== null}
                onClick={() =>
                  void action(itemKey, () =>
                    shopApi.approveRedemption(item.id, draft || undefined),
                  )
                }
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy !== null}
                onClick={() =>
                  void action(itemKey, () => shopApi.declineRedemption(item.id))
                }
              >
                Decline
              </Button>
              <button
                className="text-accent text-xs min-h-[36px]"
                aria-expanded={expanded === itemKey}
                onClick={() =>
                  setExpanded(expanded === itemKey ? null : itemKey)
                }
              >
                Pickup instructions
              </button>
            </>
          )}
          {type === 'pickups' && (
            <Button
              size="sm"
              loading={busy === itemKey}
              disabled={busy !== null}
              onClick={() =>
                void action(itemKey, () => shopApi.fulfillRedemption(item.id))
              }
            >
              Mark fulfilled
            </Button>
          )}
          {type === 'help' && (
            <>
              <Link
                className="text-sm text-accent font-semibold min-h-[36px] inline-flex items-center"
                to={`/assignments/${item.assignment_id}`}
              >
                Open assignment
              </Link>
              <button
                className="text-sm text-accent min-h-[36px]"
                aria-expanded={expanded === itemKey}
                onClick={() =>
                  setExpanded(expanded === itemKey ? null : itemKey)
                }
              >
                Reply
              </button>
              <Button
                size="sm"
                loading={busy === itemKey}
                disabled={busy !== null}
                onClick={() =>
                  void action(itemKey, () =>
                    api.post(`/assignments/help-requests/${item.id}/resolve`, {
                      response: draft.trim() || null,
                    }),
                  )
                }
              >
                Resolved / helped in person
              </Button>
            </>
          )}
        </div>
        {expanded === itemKey && (
          <>
            <TextArea
              label={
                type === 'help'
                  ? `Reply to ${item.student_name}`
                  : `Pickup instructions for ${item.student_name}`
              }
              rows={2}
              maxLength={1000}
              value={draft}
              onChange={(e) =>
                setDrafts((prev) => ({ ...prev, [itemKey]: e.target.value }))
              }
            />
            {type === 'help' && (
              <Button
                size="sm"
                disabled={busy !== null || !draft.trim()}
                onClick={() =>
                  void action(itemKey, () =>
                    api.post(`/assignments/help-requests/${item.id}/resolve`, {
                      response: draft.trim(),
                    }),
                  )
                }
              >
                Send reply & resolve
              </Button>
            )}
          </>
        )}
        {errors[itemKey] && (
          <p role="alert" className="text-sm text-neg-fg">
            {errors[itemKey]}
          </p>
        )}
      </li>
    )
  }
  const groups = read.data?.groups
  const visibleCategories = categories.filter(
    (c) => pointsEnabled || !['approvals', 'pickups'].includes(c.value),
  )
  return (
    <>
      <DashboardSection
        title="Teacher inbox"
        {...read}
        tools={
          <select
            aria-label="Inbox category"
            className="bg-field-bg border border-line rounded-field p-2 text-sm"
            value={category}
            onChange={(e) => onCategory(e.target.value as InboxCategory)}
          >
            <option value="all">All categories</option>
            {visibleCategories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        }
      >
        <p className="text-xs text-muted mb-3">
          Pending requests from any date · oldest first
        </p>
        {groups && (
          <div className="space-y-5">
            {visibleCategories
              .filter((c) => category === 'all' || category === c.value)
              .map((c) => {
                const group = groups[c.value]
                return (
                  <div key={c.value}>
                    <div className="flex flex-wrap justify-between gap-2 mb-2">
                      <h3 className="font-semibold text-sm">
                        {c.label} · {group?.total ?? 0}
                      </h3>
                      {category === 'all' && !!group?.total && (
                        <button
                          className="text-xs text-accent min-h-[32px]"
                          onClick={() => onCategory(c.value)}
                        >
                          View all {group.total}
                        </button>
                      )}
                    </div>
                    {group?.items.length ? (
                      <ul className="space-y-2">
                        {group.items.map((item) => renderItem(item, c.value))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted">
                        Nothing waiting here.
                      </p>
                    )}
                    {category !== 'all' && group && (
                      <OffsetNavigation
                        offset={read.data?.offset ?? offset}
                        total={group.total}
                        hasMore={group.has_more}
                        limit={10}
                        onChange={(value) =>
                          setNavigation({ key, offset: value })
                        }
                      />
                    )}
                  </div>
                )
              })}
          </div>
        )}
        {category === 'journals' && (
          <Link
            className="block text-xs text-accent mt-3"
            to={dashboardHref('/journal', {
              review: 'needs',
              student_id: studentId,
              active_students: true,
            })}
          >
            Open journal review list
          </Link>
        )}
        {(category === 'approvals' || category === 'pickups') && (
          <Link
            className="block text-xs text-accent mt-3"
            to={dashboardHref('/admin/shop', {
              tab: 'redemptions',
              queue: category === 'approvals' ? 'pending' : 'ready',
              student_id: studentId,
              active_students: true,
            })}
          >
            Open shop queue
          </Link>
        )}
      </DashboardSection>
      {journalId !== null && (
        <JournalReviewDialog
          key={journalId}
          id={journalId}
          onClose={() => setJournalId(null)}
          onChanged={refresh}
        />
      )}
    </>
  )
}
