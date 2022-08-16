import type { NextPage } from "next";
import { useRouter } from "next/router";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
	Table,
	ScrollArea,
	UnstyledButton,
	Group,
	Text,
	Center,
	TextInput,
	Tooltip,
	ActionIcon,
	Tabs,
	Button,
	LoadingOverlay,
	Divider,
	Collapse,
	NumberInput,
	TabsValue,
	Pagination,
} from "@mantine/core";
import { keys } from "@mantine/utils";
import { showNotification } from "@mantine/notifications";
import { IconSearch, IconEdit, IconTrash, IconFilePlus, IconLego, IconLetterA, IconLicense, IconDeviceWatch, IconRefresh } from "@tabler/icons";
import { IDashboardProps } from "../../../interfaces/props/Dashboard";
import { INote, validNoteSort, NoteSort } from "../../../interfaces/db";
import { addQueryParam, removeQueryParam, SERVER_V1, formatDateWithTz } from "../../../helper";
import { Th, useTableStyles, MConfirmContinue, TitleDashboard } from "../../Utils/Dashboard";

export const Note: NextPage<IDashboardProps> = (props) => {
	const { classes } = useTableStyles();
	const router = useRouter();
	const [modalHandle, setModalHandle] = useState({ opened: false, closeFunc: () => {}, confirmFunc: () => {} });
	const [idDelete, setIdDelete] = useState("");

	const [curPage, setCurPage] = useState(1);
	const [pages, setPages] = useState(1);
	const [perPage, setPerPage] = useState(25);

	const [searchAll, setSearchAll] = useState("");
	const [searchTitle, setSearchTitle] = useState("");
	const [searchContent, setSearchContent] = useState("");
	const [searchAuthor, setSearchAuthor] = useState("");
	const [searchCreatedAt, setSearchCreatedAt] = useState("");

	const [notesDataAll, setNotesDataAll] = useState<INote[]>([]);
	const [notesData, setNotesData] = useState<INote[]>([]);
	const [sortBy, setSortBy] = useState<validNoteSort | null>(null);

	const [reverseSortDirection, setReverseSortDirection] = useState(false);
	const [loadingDataPage, setLoadingDataPage] = useState(true);
	const [loadingDataAll, setLoadingDataAll] = useState(true);
	const [tabIndex, setTabIndex] = useState(0);

	const [tz, setTz] = useState("UTC");

	// -----------------------------------------------------------
	const resetModalHandle = () => {
		setModalHandle({ opened: false, closeFunc: () => {}, confirmFunc: () => {} });
	};

	const handleInputQueryChange = (e: React.ChangeEvent<HTMLInputElement>, setFunc: (value: string) => void, param: string) => {
		setFunc(e.target.value);
		if (e.target.value === "") removeQueryParam(router, param);
		else addQueryParam(router, param, e.target.value);
	};

	const handleTabChange = (index: TabsValue) => {
		setTabIndex(index ? parseInt(index) : 0);
		addQueryParam(router, "tab", index ? index : "0");
	};

	const pageChange = (page: number) => {
		setCurPage(page);
		addQueryParam(router, "page", page.toString());
		fillData(perPage, page);
	};

	// -----------------------------------------------------------
	// display
	const searchAllHelper = (item: INote, query: string) => {
		return (
			item.title.toLowerCase().includes(query.toLowerCase()) ||
			item.content.toLowerCase().includes(query.toLowerCase()) ||
			item.author[0].username.toLowerCase().includes(query.toLowerCase()) ||
			formatDateWithTz(item.createdAt, tz).toLowerCase().includes(query.toLowerCase())
		);
	};

	const isSearching = () => {
		// not on setting page and is actually searching and data all is fetched
		return tabIndex !== 2 && notesDataAll.length > 0 && (searchAll !== "" || searchTitle !== "" || searchContent !== "" || searchAuthor !== "" || searchCreatedAt !== "");
	};

	const searchData = (dataPage: INote[], dataAll: INote[]) => {
		// verify searching
		if (isSearching()) dataPage = dataAll;

		if (tabIndex === 0) {
			if (searchAll !== "") dataPage = dataPage.filter((item) => keys(dataPage[0]).some(() => searchAllHelper(item, searchAll)));
		} else if (tabIndex === 1) {
			if (searchTitle !== "") dataPage = dataPage.filter((item) => item.title.toLowerCase().includes(searchTitle.toLowerCase()));
			if (searchContent !== "") dataPage = dataPage.filter((item) => item.content.toLowerCase().includes(searchContent.toLowerCase()));
			if (searchAuthor !== "") dataPage = dataPage.filter((item) => item.author[0].username.toLowerCase().includes(searchAuthor.toLowerCase()));
			if (searchCreatedAt !== "") dataPage = dataPage.filter((item) => formatDateWithTz(item.createdAt, tz).toLowerCase().includes(searchCreatedAt.toLowerCase()));
		}

		return dataPage;
	};

	const sortSearchData = (type: validNoteSort | null, dataPage: INote[], dataAll: INote[]) => {
		if (!type) return searchData(dataPage, dataAll);

		if (isSearching()) dataPage = dataAll.length > 0 ? dataAll : dataPage;
		const sortMap: NoteSort = {
			title: (a: INote, b: INote) => a.title.localeCompare(b.title),
			content: (a: INote, b: INote) => a.content.localeCompare(b.content),
			author: (a: INote, b: INote) => a.author[0].username.localeCompare(b.author[0].username),
			createdAt: (a: INote, b: INote) => new Date(b.createdAt).valueOf() - new Date(a.createdAt).valueOf(),
		};

		// sort
		let sortedData = dataPage.sort(sortMap[type]);
		if (reverseSortDirection) sortedData.reverse();

		return searchData(sortedData, dataAll);
	};

	// -----------------------------------------------------------
	// delete
	const deleteNote = async (id: string) => {
		try {
			const deleteFetch = await fetch(`${SERVER_V1}/note/${id}`, {
				method: "DELETE",
				headers: {
					"Content-Type": "application/json",
				},
				credentials: "include",
			});

			const deleteData = await deleteFetch.json();
			if (deleteFetch.status === 200 && deleteData && deleteData.success) {
				// slice data
				setNotesData((prev) => {
					return prev.filter((item) => item._id !== id);
				});
				setNotesDataAll((prev) => {
					return prev.filter((item) => item._id !== id);
				});

				showNotification({ title: "Success", message: deleteData.message });
			} else {
				showNotification({ title: "Error", message: deleteData.message, color: "red" });
			}
			resetModalHandle();
		} catch (error: any) {
			resetModalHandle();
			showNotification({ title: "Error", message: error.message, color: "red" });
		}
	};

	// fetch
	const fillDataAll = async () => {
		try {
			setLoadingDataAll(true);
			const fetchData = await fetch(SERVER_V1 + `/note`, {
				method: "GET",
				headers: {
					"Content-Type": "application/json",
				},
				credentials: "include",
			});

			const { data, message }: { data: INote[]; message: string; page: number; pages: number } = await fetchData.json();
			if (fetchData.status !== 200) {
				setLoadingDataAll(false);
				return showNotification({ title: "Error indexing all data for search", message, color: "red" });
			}

			setNotesDataAll(data);
			setLoadingDataAll(false);
		} catch (error: any) {
			setLoadingDataAll(false);
			showNotification({ title: "Error indexing all data for search", message: error.message, color: "red" });
		}
	};

	const fillData = async (perPage: number, curPageQ: number) => {
		try {
			setLoadingDataPage(true);
			const fetchData = await fetch(SERVER_V1 + `/note?perPage=${perPage}&page=${curPageQ}`, {
				method: "GET",
				headers: {
					"Content-Type": "application/json",
				},
				credentials: "include",
			});

			const { data, message, page, pages }: { data: INote[]; message: string; page: number; pages: number } = await fetchData.json();
			if (fetchData.status !== 200) {
				setLoadingDataPage(false);
				return showNotification({ title: "Error getting page data", message, color: "red" });
			}

			setCurPage(page);
			setPages(pages);
			setNotesData(data);
			setLoadingDataPage(false);
		} catch (error: any) {
			setLoadingDataPage(false);
			showNotification({ title: "Error getting page data", message: error.message, color: "red" });
		}
	};

	const fetchUrlParams = () => {
		const { query } = router;
		const params = new URLSearchParams(query as unknown as string);
		// set to local state
		setCurPage(params.get("page") ? parseInt(params.get("page") || "1") : 1);
		setSearchAll(params.get("qAll") || "");
		setSearchTitle(params.get("title") || "");
		setSearchContent(params.get("content") || "");
		setSearchAuthor(params.get("author") || "");
		setSearchCreatedAt(params.get("createdAt") || "");
		setTabIndex(parseInt(params.get("tab") || "0"));
	};

	useEffect(() => {
		fetchUrlParams();
		setTz(Intl.DateTimeFormat().resolvedOptions().timeZone);
		// fill data with setting
		if (localStorage.getItem("perPage-note")) {
			setPerPage(parseInt(localStorage.getItem("perPage-note") as string));
			fillData(parseInt(localStorage.getItem("perPage-note")!), curPage);
		} else {
			localStorage.setItem("perPage-note", perPage.toString());
			fillData(perPage, curPage);
		}
		fillDataAll();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return (
		<>
			<MConfirmContinue opened={modalHandle.opened} closeFunc={modalHandle.closeFunc} confirmFunc={modalHandle.confirmFunc} />
			<TitleDashboard title="Notes" hrefAddNew={`${props.pathname}/create`} hrefText="Add new" />

			<div>
				<Tabs value={tabIndex.toString() || "0"} onTabChange={handleTabChange}>
					<Tabs.List>
						<Tabs.Tab value="0" color="green">
							Search
						</Tabs.Tab>
						<Tabs.Tab value="1" color="lime">
							Advanced Search
						</Tabs.Tab>
						<Tabs.Tab value="2" color="blue">
							Setting
						</Tabs.Tab>
					</Tabs.List>

					<div className="dash-relative">
						<LoadingOverlay visible={loadingDataAll} overlayBlur={3} />
						<Tabs.Panel value="0" pt="xs">
							<Collapse in={tabIndex === 0}>
								<Text color="dimmed">Quick search by any field</Text>
								<TextInput
									placeholder="Search by any field"
									name="qAll"
									mb="md"
									icon={<IconSearch size={14} stroke={1.5} />}
									value={searchAll}
									onChange={(e) => handleInputQueryChange(e, setSearchAll, e.target.name)}
									mt={16}
								/>
							</Collapse>
						</Tabs.Panel>

						<Tabs.Panel value="1" pt="xs" className="dash-textinput-gap">
							<Collapse in={tabIndex === 1}>
								<Text color="dimmed">Search more accurately by searching for each field</Text>

								<TextInput
									placeholder="Search by title field"
									name="title"
									label="Title"
									icon={<IconLetterA size={14} stroke={1.5} />}
									value={searchTitle}
									onChange={(e) => handleInputQueryChange(e, setSearchTitle, e.target.name)}
									mt={16}
								/>
								<TextInput
									placeholder="Search by content field"
									name="content"
									label="Content"
									icon={<IconLicense size={14} stroke={1.5} />}
									value={searchContent}
									onChange={(e) => handleInputQueryChange(e, setSearchContent, e.target.name)}
									mt={8}
								/>
								<TextInput
									placeholder="Search by author field"
									name="author"
									label="Author"
									icon={<IconLego size={14} stroke={1.5} />}
									value={searchAuthor}
									onChange={(e) => handleInputQueryChange(e, setSearchAuthor, e.target.name)}
									mt={8}
								/>
								<TextInput
									placeholder="Search by createdAt field"
									label="Created At"
									name="createdAt"
									icon={<IconDeviceWatch size={14} stroke={1.5} />}
									value={searchCreatedAt}
									onChange={(e) => handleInputQueryChange(e, setSearchCreatedAt, e.target.name)}
									mt={8}
								/>
							</Collapse>
						</Tabs.Panel>
					</div>
					<Tabs.Panel value="2" pt="xs" className="dash-textinput-gap">
						<Collapse in={tabIndex === 2}>
							<Text color="dimmed">Customize data load setting</Text>

							<NumberInput
								label="Item per page"
								placeholder="Item per page"
								description="How many item per page in the dashboard (default: 25, min: 5, max: 100). Search is not affected by this setting."
								value={perPage}
								stepHoldDelay={500}
								stepHoldInterval={100}
								min={5}
								max={100}
								onChange={(value) => {
									if (!value) return;
									setPerPage(value);
									localStorage.setItem("perPage-note", value.toString());
								}}
								mt={8}
							/>

							<Button
								compact
								leftIcon={<IconRefresh size={20} />}
								onClick={() => {
									fillData(perPage, curPage);
									fillDataAll();
								}}
								mt={16}
							>
								Reload the table
							</Button>
						</Collapse>
					</Tabs.Panel>
				</Tabs>
			</div>

			<Divider mt={16} mb={16} />

			<div className="dash-relative">
				<LoadingOverlay visible={loadingDataPage} overlayBlur={3} />
				<ScrollArea mt={30}>
					<Table horizontalSpacing="md" verticalSpacing="xs" sx={{ tableLayout: "fixed", width: "100%" }} highlightOnHover>
						<thead>
							<tr>
								<Th
									classes={classes}
									sorted={sortBy === "title"}
									reversed={reverseSortDirection}
									onSort={() => {
										if (sortBy === "title") setReverseSortDirection(!reverseSortDirection);
										setSortBy("title");
									}}
									width="15%"
								>
									Title
								</Th>
								<Th
									classes={classes}
									sorted={sortBy === "content"}
									reversed={reverseSortDirection}
									onSort={() => {
										if (sortBy === "content") setReverseSortDirection(!reverseSortDirection);
										setSortBy("content");
									}}
									width="40%"
								>
									Content
								</Th>
								<Th
									classes={classes}
									sorted={sortBy === "author"}
									reversed={reverseSortDirection}
									onSort={() => {
										if (sortBy === "author") setReverseSortDirection(!reverseSortDirection);
										setSortBy("author");
									}}
									width="18%"
								>
									Author
								</Th>
								<Th
									classes={classes}
									sorted={sortBy === "createdAt"}
									reversed={reverseSortDirection}
									onSort={() => {
										if (sortBy === "createdAt") setReverseSortDirection(!reverseSortDirection);
										setSortBy("createdAt");
									}}
									width="17%"
								>
									Created At
								</Th>
								<th className={classes.th} style={{ width: "10%" }}>
									<UnstyledButton className={classes.control}>
										<Group position="apart">
											<Text weight={500} size="sm">
												Action
											</Text>
										</Group>
									</UnstyledButton>
								</th>
							</tr>
						</thead>
						<tbody>
							{notesData && notesData.length > 0 && sortSearchData(sortBy, notesData, notesDataAll).length > 0 ? (
								sortSearchData(sortBy, notesData, notesDataAll).map((row) => (
									<tr key={row._id}>
										<td>
											<Link href={`${props.pathname}/${row._id}`}>
												<a>
													<Text variant="link">{row.title}</Text>
												</a>
											</Link>
										</td>
										<td dangerouslySetInnerHTML={{ __html: row.content }}></td>
										<td>
											{row.editedBy && row.editedBy[0] ? (
												<>
													<Tooltip label={`Last edited by: ${row.editedBy[0].username}`}>
														<span>{row.author[0].username}</span>
													</Tooltip>
												</>
											) : (
												row.author[0].username
											)}
										</td>
										<td>
											{row.updatedAt !== row.createdAt ? (
												<Tooltip label={`Last edited at: ${formatDateWithTz(row.updatedAt, tz)}`}>
													<span>{formatDateWithTz(row.createdAt, tz)}</span>
												</Tooltip>
											) : (
												<>{formatDateWithTz(row.createdAt, tz)}</>
											)}
										</td>
										<td style={{ padding: "1rem .5rem" }}>
											<div className="dash-flex">
												<Link href={`${props.pathname}/${row._id}`}>
													<ActionIcon>
														<IconEdit size={14} stroke={1.5} />
													</ActionIcon>
												</Link>
												<ActionIcon
													onClick={() => {
														setIdDelete(row._id);
														setModalHandle({
															opened: true,
															closeFunc: () => resetModalHandle(),
															confirmFunc: () => deleteNote(idDelete),
														});
													}}
												>
													<IconTrash size={14} stroke={1.5} />
												</ActionIcon>
											</div>
										</td>
									</tr>
								))
							) : (
								<>
									<tr>
										<td colSpan={5}>
											<Text weight={500} align="center">
												Nothing found
											</Text>
										</td>
									</tr>
								</>
							)}
						</tbody>
					</Table>
				</ScrollArea>
			</div>
			<Center mt={16}>{!isSearching() && <Pagination total={pages} page={curPage} onChange={pageChange} />}</Center>
		</>
	);
};
