import type { SvgIconComponent } from '@mui/icons-material';
import AdjustIcon from '@mui/icons-material/Adjust';
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked';
import ChangeHistoryIcon from '@mui/icons-material/ChangeHistory';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import BoltIcon from '@mui/icons-material/Bolt';
import HexagonIcon from '@mui/icons-material/Hexagon';
import CircleOutlinedIcon from '@mui/icons-material/CircleOutlined';
import AlbumIcon from '@mui/icons-material/Album';
import type { InstrumentType } from '../rhythms/RhythmPatterns';

// Map of Icons
export const InstrumentIcons: Record<InstrumentType, SvgIconComponent> = {
    kick: RadioButtonCheckedIcon,
    snare: AdjustIcon,
    hihat: ChangeHistoryIcon,
    ride: AlbumIcon,
    tom_high: CircleOutlinedIcon,
    tom_low: CircleOutlinedIcon,
    tom_floor: CircleOutlinedIcon,
    crash: HexagonIcon,
    bombo_leguero: AdjustIcon,
    click: CircleOutlinedIcon,
    shaker: BoltIcon,
    clave: MusicNoteIcon,
    rim: RadioButtonCheckedIcon,
    surdo: RadioButtonCheckedIcon,
    hihat_foot: ChangeHistoryIcon,
    caja: AdjustIcon,
    cajon: HexagonIcon,
    palmas: RadioButtonCheckedIcon,
    candombe_chico: AdjustIcon,
    candombe_repique: AdjustIcon,
    candombe_piano: AdjustIcon
};
